import logging

from celery import shared_task

from shipping.pigeon_express import PigeonExpressAPIError

from .services import refresh_pigeon_express_tracking

logger = logging.getLogger(__name__)


@shared_task
def refresh_pigeon_express_tracking_task() -> None:
    """Hourly (config/settings.py CELERY_BEAT_SCHEDULE) — Pigeon Express has
    no webhooks, so this is how orders learn their shipment was delivered.
    A failure is only logged: the next hourly run simply tries again, and
    nothing else depends on this being current."""
    try:
        updated = refresh_pigeon_express_tracking()
    except PigeonExpressAPIError as exc:
        logger.warning("Pigeon Express tracking refresh failed: %s", exc.message)
        return
    logger.info("Pigeon Express tracking refreshed for %s orders", updated)
