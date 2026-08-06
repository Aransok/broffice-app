from django.conf import settings
from django.db import models

from common.models import TimeStampedModel


class ProductView(TimeStampedModel):
    """One row per (user, product) — a running counter, not a per-visit log.

    Privacy-by-design (spec #26): authenticated users only (no anonymous/guest
    tracking), and only the minimum needed to power individual promotions —
    no IP, no user agent, no per-visit timestamps piling up forever.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="product_views", on_delete=models.CASCADE
    )
    product = models.ForeignKey(
        "products.Product", related_name="views", on_delete=models.CASCADE
    )
    # Denormalized snapshot of the product's category at last view time, so
    # "most-viewed categories" can be reported without joining through a
    # product that may since have been re-categorized or archived.
    category = models.ForeignKey(
        "categories.Category",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    view_count = models.PositiveIntegerField(default=1)
    last_viewed_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_viewed_at"]
        unique_together = [("user", "product")]
        indexes = [models.Index(fields=["user", "last_viewed_at"])]

    def __str__(self) -> str:
        return f"{self.user} viewed {self.product} x{self.view_count}"
