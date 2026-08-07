import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from .management.commands.sync_supplier_catalog import (
    Command as SyncSupplierCatalogCommand,
)

logger = logging.getLogger(__name__)


@shared_task
def sync_supplier_catalog_task() -> None:
    """Scheduled counterpart to the admin's manual "Sync" button
    (api/views.py ProductViewSet.sync) — same command, same
    created_count/updated_count attributes, just Celery Beat-triggered
    instead of a request. A failure here is silent to everyone unless it's
    surfaced somewhere a human will actually see it, since nothing else
    depends on this ever succeeding — logged, and emailed to the admin
    address so a broken supplier feed doesn't go unnoticed for days."""
    if not settings.SUPPLIER_CATALOG_API_KEY:
        logger.warning(
            "Skipping supplier catalog sync: SUPPLIER_CATALOG_API_KEY not set."
        )
        return

    try:
        command = SyncSupplierCatalogCommand()
        command.handle()
    except Exception as exc:
        logger.exception("Scheduled supplier catalog sync failed")
        send_mail(
            subject="BRoffice: неуспешна нощна синхронизация с доставчика",
            message=(
                f"Автоматичната нощна синхронизация на каталога се провали:\n\n{exc}\n\n"
                "Може да се пусне ръчно от админ панела (Продукти -> Синхронизирай)."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[settings.ADMIN_ORDER_EMAIL],
            fail_silently=True,
        )
        return

    logger.info(
        "Scheduled supplier catalog sync: %s created, %s updated",
        command.created_count,
        command.updated_count,
    )
