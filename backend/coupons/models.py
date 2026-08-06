import uuid

from django.conf import settings
from django.db import models

from common.models import TimeStampedModel


class Coupon(TimeStampedModel):
    """A code a customer types at checkout for a whole-cart discount —
    distinct from `promotions.Promotion`, which is automatic and always
    scoped to one product/category/user, never entered by hand. Single-use
    by design (redeeming sets `redeemed_at`/`redeemed_by`/`redeemed_order`
    and the code can never be applied again), matching the client's ask:
    "give them to clients... they can use once"."""

    TYPE_PERCENT = "percent"
    TYPE_FLAT = "flat"
    TYPE_CHOICES = [(TYPE_PERCENT, "Percent"), (TYPE_FLAT, "Flat amount off")]

    code = models.CharField(max_length=32, unique=True, db_index=True)
    discount_type = models.CharField(
        max_length=16, choices=TYPE_CHOICES, default=TYPE_PERCENT
    )
    value = models.DecimalField(max_digits=12, decimal_places=2)
    # Guards a flat coupon from wiping out a cheap cart entirely (e.g. a €5
    # flat coupon on a €5 item would make it free) — None = no minimum.
    # Equally applicable to percent coupons, so it's not type-restricted.
    min_order_amount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    # Empty = anyone with the code can redeem it (a general promo code); set
    # = only that one customer can (a personal one-off, e.g. a thank-you).
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="coupons",
        on_delete=models.CASCADE,
    )
    active = models.BooleanField(default=True)
    redeemed_at = models.DateTimeField(null=True, blank=True)
    redeemed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="redeemed_coupons",
        on_delete=models.SET_NULL,
    )
    redeemed_order = models.ForeignKey(
        "orders.Order",
        null=True,
        blank=True,
        related_name="coupon_redemptions",
        on_delete=models.SET_NULL,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.code

    @property
    def is_redeemed(self) -> bool:
        return self.redeemed_at is not None

    @staticmethod
    def generate_code() -> str:
        return uuid.uuid4().hex[:8].upper()
