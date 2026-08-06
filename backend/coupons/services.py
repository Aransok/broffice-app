from decimal import Decimal

from django.utils import timezone

from common.currency import format_both_currencies

from .models import Coupon


class CouponError(Exception):
    """Raised with a user-facing Bulgarian message — the same message is
    shown whether the code is wrong, expired, already used, or belongs to
    someone else, except where telling the truth doesn't leak anything
    (there's no enumeration concern here the way there is for password
    reset — coupon codes aren't usernames/emails)."""


def get_valid_coupon(code: str, user) -> Coupon:
    coupon = Coupon.objects.filter(code__iexact=code.strip()).first()
    if coupon is None:
        raise CouponError("Невалиден купон код.")
    if not coupon.active or coupon.is_redeemed:
        raise CouponError("Този купон вече е използван или неактивен.")
    is_authenticated = user is not None and getattr(user, "is_authenticated", False)
    if coupon.user_id is not None:
        if not is_authenticated or coupon.user_id != user.id:
            raise CouponError("Този купон не важи за вашия акаунт.")
    return coupon


def check_min_order_amount(coupon: Coupon, subtotal: Decimal) -> None:
    """Guards a flat coupon from wiping out a cheap cart entirely (e.g. a €5
    flat coupon on a €5 item would make it free) — called both from the
    checkout preview and, authoritatively, from create_order once the real
    subtotal is known."""
    if coupon.min_order_amount is not None and subtotal < coupon.min_order_amount:
        raise CouponError(
            f"Купонът важи за поръчки над {format_both_currencies(coupon.min_order_amount)}."
        )


def calculate_coupon_discount(coupon: Coupon, subtotal: Decimal) -> Decimal:
    if coupon.discount_type == Coupon.TYPE_PERCENT:
        discount = subtotal * coupon.value / Decimal("100")
    else:
        discount = coupon.value
    # Never below zero, never more than the subtotal itself.
    return max(Decimal("0"), min(discount, subtotal)).quantize(Decimal("0.01"))


def redeem_coupon(coupon: Coupon, user, order) -> None:
    coupon.redeemed_at = timezone.now()
    coupon.redeemed_by = (
        user if user is not None and getattr(user, "is_authenticated", False) else None
    )
    coupon.redeemed_order = order
    coupon.active = False
    coupon.save(
        update_fields=[
            "redeemed_at",
            "redeemed_by",
            "redeemed_order",
            "active",
            "updated_at",
        ]
    )
