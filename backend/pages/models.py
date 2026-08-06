from django.db import models

from common.models import SoftStatusModel, TimeStampedModel


class Page(TimeStampedModel, SoftStatusModel):
    slug = models.SlugField(max_length=255, unique=True)
    title = models.CharField(max_length=512)
    body = models.TextField(blank=True, default="")
    seo = models.OneToOneField(
        "seo.SEO",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="page",
    )

    def __str__(self) -> str:
        return self.title
