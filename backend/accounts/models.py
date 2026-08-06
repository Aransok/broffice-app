from django.contrib.auth.models import User
from django.db import models

from common.models import TimeStampedModel


class Profile(TimeStampedModel):
    user = models.OneToOneField(User, related_name="profile", on_delete=models.CASCADE)
    phone = models.CharField(max_length=64, blank=True, default="")
    company = models.CharField(max_length=255, blank=True, default="")
    is_admin_portal = models.BooleanField(
        default=False,
        help_text="Show admin nav links (/products, /notifications, /promotions)",
    )
    # Prep only, per the same "structure for later, don't build the feature
    # yet" pattern as Product.supplier_* — no verification email is sent and
    # nothing is gated on this; it exists so a future email-verification flow
    # has somewhere to record its result instead of silently pretending every
    # self-registered account is already verified.
    email_verified = models.BooleanField(default=False)
    terms_accepted_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return self.user.username


class Address(TimeStampedModel):
    user = models.ForeignKey(User, related_name="addresses", on_delete=models.CASCADE)
    label = models.CharField(max_length=64, blank=True, default="")
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=64)
    city = models.CharField(max_length=128)
    post_code = models.CharField(max_length=16, blank=True, default="")
    address_line = models.CharField(max_length=512)
    is_default = models.BooleanField(default=False)

    class Meta:
        ordering = ["-is_default", "-created_at"]
        indexes = [models.Index(fields=["user", "is_default"])]

    def __str__(self) -> str:
        return f"{self.full_name} ({self.city})"
