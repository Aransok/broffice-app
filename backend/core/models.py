from django.db import models

from common.models import TimeStampedModel


class SiteSettings(TimeStampedModel):
    site_name = models.CharField(max_length=255, default="Office Center BG")
    phone = models.CharField(max_length=64, blank=True, default="0700 45 095")
    currency = models.CharField(max_length=8, default="BGN")
    language = models.CharField(max_length=8, default="bg")
    # Pigeon Express office we drop parcels off at — picked in the admin
    # panel (AdminPigeonExpressPickupOfficeView). Blank falls back to the
    # PIGEON_EXPRESS_PICKUP_OFFICE_ID env var. The name is display-only.
    pigeon_express_pickup_office_id = models.CharField(
        max_length=64, blank=True, default=""
    )
    pigeon_express_pickup_office_name = models.CharField(
        max_length=255, blank=True, default=""
    )

    class Meta:
        verbose_name_plural = "Site settings"

    def __str__(self) -> str:
        return self.site_name
