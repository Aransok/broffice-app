from django.conf import settings
from django.db import models

from common.models import TimeStampedModel


class Cart(TimeStampedModel):
    """Server-side cart for logged-in customers only.

    Guest checkout stays client-side (localStorage) as originally designed —
    this exists purely so admin can view/edit a specific customer's cart
    (spec #3/#4). No price is ever stored here: totals are always computed
    live via pricing.services.get_effective_price, same as at checkout, so
    there's nothing here that can go stale or be tampered with.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, related_name="cart", on_delete=models.CASCADE
    )

    def __str__(self) -> str:
        return f"Cart({self.user})"


class CartItem(TimeStampedModel):
    cart = models.ForeignKey(Cart, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(
        "products.Product", related_name="+", on_delete=models.CASCADE
    )
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["created_at"]
        unique_together = [("cart", "product")]

    def __str__(self) -> str:
        return f"{self.product} x{self.quantity}"
