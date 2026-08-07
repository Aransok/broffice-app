from django.db import models

from common.models import TimeStampedModel


class SEO(TimeStampedModel):
    title = models.CharField(max_length=512, blank=True, default="")
    description = models.TextField(blank=True, default="")
    keywords = models.CharField(max_length=1024, blank=True, default="")
    canonical = models.CharField(max_length=1024, blank=True, default="")
    robots = models.CharField(max_length=255, blank=True, default="")
    open_graph = models.JSONField(default=dict, blank=True)
    json_ld = models.JSONField(default=list, blank=True)
    entity_type = models.CharField(max_length=64, blank=True, default="", db_index=True)
    entity_id = models.CharField(max_length=64, blank=True, default="", db_index=True)

    def __str__(self) -> str:
        return self.title or f"SEO {self.id}"


class Redirect(TimeStampedModel):
    from_path = models.CharField(max_length=1024, unique=True)
    to_path = models.CharField(max_length=1024)
    status_code = models.PositiveIntegerField(default=301)

    def __str__(self) -> str:
        return f"{self.from_path} → {self.to_path}"
