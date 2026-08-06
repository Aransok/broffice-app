from django.conf import settings
from django.db import models

from common.models import TimeStampedModel


class AdminPriceOverride(TimeStampedModel):
    product = models.ForeignKey(
        "products.Product",
        related_name="price_overrides",
        on_delete=models.CASCADE,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="price_overrides",
        on_delete=models.CASCADE,
    )
    admin_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    client_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    notes = models.CharField(max_length=512, blank=True, default="")

    class Meta:
        unique_together = [("product", "user")]

    def __str__(self) -> str:
        return f"Override {self.product_id}"
