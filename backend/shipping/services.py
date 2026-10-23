"""Speedy courier integration.

No real Speedy API credentials/documentation were available when this was
built (see docs/issues/speedy-api-shape.md) — SpeedyClient defines the
interface a real implementation must satisfy; MockSpeedyClient is a working
stand-in backed by locally seeded SpeedyOffice rows. Swapping in a real
client later is a one-line settings change (SHIPPING_SPEEDY_CLIENT), no
caller changes required.
"""

from abc import ABC, abstractmethod
from decimal import Decimal

from django.conf import settings
from django.utils.module_loading import import_string

from .models import SpeedyOffice


class SpeedyClient(ABC):
    @abstractmethod
    def search_offices(
        self, city: str, query: str = "", site_id: str = ""
    ) -> list[SpeedyOffice]:
        raise NotImplementedError

    def search_cities(self, query: str) -> list[dict]:
        return []

    @abstractmethod
    def get_office(self, external_id: str) -> SpeedyOffice | None:
        raise NotImplementedError

    def search_streets(self, site_id: str, query: str) -> list[dict]:
        return []

    @abstractmethod
    def calculate_price(
        self, *, weight_kg: Decimal, site_id: str = "", office_id: str = ""
    ) -> Decimal:
        """Delivery price in BGN, VAT included — to an office, or to an
        address in the site."""
        raise NotImplementedError

    def create_shipment(self, order, *, weight_kg: Decimal) -> dict:
        """Register a shipment with the courier: {"waybill", "label_pdf"}.
        Only the real client (shipping.speedy) implements it."""
        raise NotImplementedError("create_shipment requires a real Speedy API client")


class MockSpeedyClient(SpeedyClient):
    def search_offices(
        self, city: str, query: str = "", site_id: str = ""
    ) -> list[SpeedyOffice]:
        qs = SpeedyOffice.objects.filter(is_active=True)
        if city:
            qs = qs.filter(city__icontains=city)
        if query:
            qs = qs.filter(name__icontains=query)
        return list(qs[:50])

    def get_office(self, external_id: str) -> SpeedyOffice | None:
        return SpeedyOffice.objects.filter(
            external_id=external_id, is_active=True
        ).first()

    def calculate_price(
        self, *, weight_kg: Decimal, site_id: str = "", office_id: str = ""
    ) -> Decimal:
        return Decimal(str(settings.SPEEDY_MOCK_FLAT_RATE_BGN))


def get_speedy_client() -> SpeedyClient:
    client_class = import_string(settings.SHIPPING_SPEEDY_CLIENT)
    return client_class()
