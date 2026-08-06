from django.db import models

from common.models import SoftStatusModel, TimeStampedModel


class Brand(TimeStampedModel, SoftStatusModel):
    external_id = models.CharField(max_length=64, unique=True, db_index=True)
    slug = models.SlugField(max_length=255, unique=True)
    name = models.CharField(max_length=255)
    logo_path = models.CharField(max_length=1024, blank=True, default="")

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
