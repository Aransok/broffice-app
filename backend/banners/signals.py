"""Keeps banners in sync with Promotion changes in near-real-time (create/
edit/delete), on top of the periodic Celery Beat task (config/settings.py)
that catches pure date-expiry when nobody touches the admin panel.

Dispatched via .delay() rather than run inline: banner generation runs
Pillow compositing and (for product banners) a background-removal model
pass, both too slow to do inside the admin's save request/response cycle."""

from pathlib import Path

from django.conf import settings
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from promotions.models import Promotion

from .models import Banner
from .tasks import sync_banners_task


@receiver(post_save, sender=Promotion)
@receiver(post_delete, sender=Promotion)
def _on_promotion_changed(sender, **kwargs) -> None:
    sync_banners_task.delay()


@receiver(post_delete, sender=Banner)
def _on_banner_deleted(sender, instance: Banner, **kwargs) -> None:
    # Covers both sync_banners()'s own stale-banner cleanup AND a Promotion
    # being hard-deleted: Django's CASCADE removes the Banner row as part of
    # that same delete() call, before sync_banners ever gets a chance to run
    # — this is the only place that case's leftover PNG file gets removed.
    path = Path(settings.MEDIA_ROOT) / instance.image_path
    if path.exists():
        path.unlink()
