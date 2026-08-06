from django.db import models

from common.models import SoftStatusModel, TimeStampedModel


class Category(TimeStampedModel, SoftStatusModel):
    external_id = models.CharField(max_length=64, unique=True, db_index=True)
    slug = models.SlugField(max_length=255, unique=True)
    name = models.CharField(max_length=512)
    description = models.TextField(blank=True, default="")
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        related_name="children",
        on_delete=models.SET_NULL,
    )
    image_path = models.CharField(max_length=1024, blank=True, default="")

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name
