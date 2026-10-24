from django.db import models

from common.models import TimeStampedModel

# The storefront designs the owner can switch between from the admin panel
# ("Дизайн"). Keys must match DesignPreset in frontend/src/context/
# ThemeContext.tsx and the [data-theme] blocks in frontend/src/index.css.
STOREFRONT_DESIGN_CHOICES = [
    ("classic", "Clean Business"),
    ("modern", "Modern Commerce"),
    ("compact", "Compact Professional"),
    ("premium", "Premium"),
    ("soft", "Soft / Friendly"),
    ("brand", "BRoffice (фирмени цветове)"),
    ("fresh", "BRoffice 2026"),
    ("bold", "BRoffice Bold"),
]
DEFAULT_STOREFRONT_DESIGN = "classic"


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

    # The design every visitor sees. Admins can preview any other design in
    # their own browser tab first, then make it live from there.
    storefront_design = models.CharField(
        max_length=32,
        choices=STOREFRONT_DESIGN_CHOICES,
        default=DEFAULT_STOREFRONT_DESIGN,
    )

    class Meta:
        verbose_name_plural = "Site settings"

    def __str__(self) -> str:
        return self.site_name
