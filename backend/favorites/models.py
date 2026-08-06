from django.conf import settings
from django.db import models

from common.models import TimeStampedModel


class Favorite(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="favorites", on_delete=models.CASCADE
    )
    product = models.ForeignKey(
        "products.Product", related_name="favorited_by", on_delete=models.CASCADE
    )

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("user", "product")]
        indexes = [models.Index(fields=["user", "product"])]

    def __str__(self) -> str:
        return f"{self.user} ♥ {self.product}"
