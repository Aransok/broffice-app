from django.conf import settings
from django.db import models

from common.models import SoftStatusModel, TimeStampedModel


class Promotion(TimeStampedModel, SoftStatusModel):
    TYPE_PERCENT = "percent"
    TYPE_FLAT = "flat"
    TYPE_CHOICES = [(TYPE_PERCENT, "Percent"), (TYPE_FLAT, "Flat")]

    # `scope` is the *target* — what's discounted — and is deliberately
    # independent from `user` below (who it's for). There is no "user" scope
    # value: a promotion targeting one specific client is expressed as any
    # scope (usually product or global) with `user` set, not a 4th scope.
    # This used to be a single "user" scope treated as mutually exclusive
    # with product/category/global — see migration 0003 for how existing
    # scope="user" rows were converted (product set -> scope=product+user
    # set; no product -> scope=global+user set).
    SCOPE_PRODUCT = "product"
    SCOPE_CATEGORY = "category"
    SCOPE_GLOBAL = "global"
    SCOPE_CHOICES = [
        (SCOPE_PRODUCT, "Product"),
        (SCOPE_CATEGORY, "Category"),
        (SCOPE_GLOBAL, "Global"),
    ]

    name = models.CharField(max_length=255)
    discount_type = models.CharField(
        max_length=16, choices=TYPE_CHOICES, default=TYPE_PERCENT
    )
    value = models.DecimalField(max_digits=12, decimal_places=2)
    scope = models.CharField(
        max_length=16, choices=SCOPE_CHOICES, default=SCOPE_PRODUCT
    )
    # Independent audience filter, layered on top of `scope` above: null
    # means "everyone eligible for that target", set means "only this
    # client, regardless of target" — e.g. scope=product + user=X is a
    # discount on one item for one client; scope=global + user=X is a
    # blanket discount for one client on everything.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="promotions",
        on_delete=models.CASCADE,
    )
    product = models.ForeignKey(
        "products.Product",
        null=True,
        blank=True,
        related_name="promotions",
        on_delete=models.CASCADE,
    )
    category = models.ForeignKey(
        "categories.Category",
        null=True,
        blank=True,
        related_name="promotions",
        on_delete=models.CASCADE,
    )
    active = models.BooleanField(default=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    # Caps how many units per order get the discount — e.g. a customer
    # orders 100 of a product but the promo only covers 20; the rest is
    # billed at the normal price on a second, undiscounted order line.
    # None = no cap, applies to the full quantity (previous behavior).
    max_quantity = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name
