from django.db import models

from common.models import TimeStampedModel


class SpeedyOffice(TimeStampedModel):
    external_id = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    city = models.CharField(max_length=128, db_index=True)
    address = models.CharField(max_length=512)
    phone = models.CharField(max_length=64, blank=True, default="")
    # From Speedy's address.y / address.x, for the office map at checkout.
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    raw_payload = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["city", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.city})"
