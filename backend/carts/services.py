from decimal import Decimal

from pricing.services import get_base_price, get_effective_price, get_user_overrides
from promotions.services import get_active_promotions

from .models import Cart, CartItem


def get_or_create_cart(user) -> Cart:
    cart, _ = Cart.objects.get_or_create(user=user)
    return cart


def add_item(cart: Cart, product, quantity: int) -> CartItem:
    """Adds a product, incrementing quantity if it's already in the cart.

    This is the *only* place an item gets added to a cart — both the
    customer-facing `/api/v1/cart/` endpoints and the admin per-customer
    cart-management endpoints call this same function against the same
    `Cart` row (one per user), so there is exactly one cart per customer,
    never two independent stores that could drift apart.
    """
    item, created = CartItem.objects.get_or_create(
        cart=cart, product=product, defaults={"quantity": quantity}
    )
    if not created:
        item.quantity += quantity
        item.save(update_fields=["quantity", "updated_at"])
    return item


def set_item_quantity(cart: Cart, item_id, quantity: int) -> CartItem:
    item = cart.items.get(id=item_id)
    item.quantity = quantity
    item.save(update_fields=["quantity", "updated_at"])
    return item


def remove_item(cart: Cart, item_id) -> None:
    cart.items.filter(id=item_id).delete()


def price_cart(cart: Cart) -> dict:
    """Live pricing for every line — never stored, always recomputed the same
    way an order would price it (pricing.services.get_effective_price), so
    what admin sees here can never drift from what checkout would charge."""
    active_promotions = get_active_promotions()
    user_overrides = get_user_overrides(cart.user)

    lines = []
    subtotal = Decimal(0)
    for item in cart.items.select_related("product").prefetch_related(
        "product__images"
    ):
        product = item.product
        base = get_base_price(product) or Decimal(0)
        result = get_effective_price(
            product, cart.user, active_promotions, user_overrides
        )
        unit_price = result.price if result else base
        line_total = (unit_price * item.quantity).quantize(Decimal("0.01"))
        subtotal += line_total
        images = list(product.images.all())
        lines.append(
            {
                "item_id": item.id,
                "product_id": product.id,
                "product_slug": product.slug,
                "product_name": product.name,
                "product_number": product.supplier_id or str(product.item_number or ""),
                "product_image": images[0].path if images else None,
                "quantity": item.quantity,
                "base_price": str(base),
                "unit_price": str(unit_price),
                "price_source": (
                    result.label if result and result.source != "base" else ""
                ),
                "line_total": str(line_total),
            }
        )
    return {"items": lines, "subtotal_bgn": str(subtotal)}
