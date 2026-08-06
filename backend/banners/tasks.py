from celery import shared_task

from .services import sync_banners


@shared_task
def sync_banners_task() -> None:
    sync_banners()
