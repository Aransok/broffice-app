from django.db import models

from common.models import SoftStatusModel, TimeStampedModel


class SiteSettings(TimeStampedModel):
    site_name = models.CharField(max_length=255, default="Office Center BG")
    phone = models.CharField(max_length=64, blank=True, default="0700 45 095")
    currency = models.CharField(max_length=8, default="BGN")
    language = models.CharField(max_length=8, default="bg")

    class Meta:
        verbose_name_plural = "Site settings"

    def __str__(self) -> str:
        return self.site_name
