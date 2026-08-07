"""Centralized price calculation — the one place discount/price rules live.

Priority (highest wins — never stacked):
1. The customer's individual override price (`AdminPriceOverride`, keyed by
   product+user) — sits in the pre-existing `pricing` app, originally built
   for per-admin pricing but reused here unchanged for per-customer special
   pricing (same shape: one price, one product, one user).
2. The single best matching active `Promotion` (global/category/product/user
   scope) — see `promotions/services.py` for the matching rules themselves.
3. The product's own base price (`client_price`, falling back to `price_bgn`).

An individual override is never modified or bypassed by a promotion, and two
discounts never combine — this function always returns exactly one effective
price with one clearly labeled source, which is what makes it safe to reuse
for display, cart, checkout, and order/invoice snapshots alike.
"""

from dataclasses import dataclass
from decimal import Decimal

from promotions.models import Promotion
from promotions.services import find_matching_promotions, get_active_promotions

from .models import AdminPriceOverride


@dataclass
class PriceResult:
    price: Decimal
    source: str  # "individual" | "promotion" | "base"
    label: str  # human-readable — used for order/invoice line "discount" text
    promotion: Promotion | None = None
    override: AdminPriceOverride | None = None


def get_base_price(product) -> Decimal | None:
    return product.client_price or product.price_bgn


def compute_promo_price(base: Decimal, promotion: Promotion) -> Decimal:
    """The price a promotion resolves to for a given base price — shared by
    get_effective_price below and the promo banner generator (banners/services.py),
    so both apply "percent off" / "flat = final price" identically."""
    if promotion.discount_type == Promotion.TYPE_PERCENT:
        candidate = base * (Decimal(1) - promotion.value / Decimal(100))
    else:
        # Flat is the final price itself ("this costs €X for this
        # customer"), not an amount subtracted off the base price — matches
        # how admins actually enter it (a target price).
        candidate = promotion.value
    return max(candidate, Decimal(0)).quantize(Decimal("0.01"))


def get_user_overrides(user) -> dict:
    """Fetch a user's overrides once per request (keyed by product_id) instead
    of one query per product — same N+1 avoidance as `get_active_promotions`."""
    if user is None or not getattr(user, "is_authenticated", False):
        return {}
    return {
        override.product_id: override
        for override in AdminPriceOverride.objects.filter(user=user)
    }


def get_individual_override(product, user, overrides=None) -> AdminPriceOverride | None:
    if overrides is not None:
        return overrides.get(product.id)
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    return AdminPriceOverride.objects.filter(product=product, user=user).first()


def get_effective_price(
    product, user=None, promotions=None, overrides=None
) -> PriceResult | None:
    base = get_base_price(product)
    if base is None:
        return None

    override = get_individual_override(product, user, overrides)
    if override and override.client_price is not None:
        return PriceResult(
            price=override.client_price.quantize(Decimal("0.01")),
            source="individual",
            label="Индивидуална цена",
            override=override,
        )

    if promotions is None:
        promotions = get_active_promotions()
    matches = find_matching_promotions(product, user, promotions)
    if matches:
        best_price = base
        best_promo = None
        for promo in matches:
            candidate = compute_promo_price(base, promo)
            if best_promo is None or candidate < best_price:
                best_price = candidate
                best_promo = promo
        if best_promo is not None:
            return PriceResult(
                price=best_price,
                source="promotion",
                label=best_promo.name,
                promotion=best_promo,
            )

    return PriceResult(price=base.quantize(Decimal("0.01")), source="base", label="")
