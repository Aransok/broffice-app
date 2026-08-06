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
    def search_offices(self, city: str, query: str = "") -> list[SpeedyOffice]:
        raise NotImplementedError

    @abstractmethod
    def get_office(self, external_id: str) -> SpeedyOffice | None:
        raise NotImplementedError

    @abstractmethod
    def calculate_price(
        self, *, shipping_method: str, city: str, weight_kg: Decimal | None = None
    ) -> Decimal:
        raise NotImplementedError

    def create_shipment(self, order) -> dict:
        """Register a shipment with the courier. Not wired up anywhere yet —
        there is no real API access to build or test this against."""
        raise NotImplementedError("create_shipment requires a real Speedy API client")


class MockSpeedyClient(SpeedyClient):
    def search_offices(self, city: str, query: str = "") -> list[SpeedyOffice]:
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
        self, *, shipping_method: str, city: str, weight_kg: Decimal | None = None
    ) -> Decimal:
        return Decimal(str(settings.SPEEDY_MOCK_FLAT_RATE_BGN))


def get_speedy_client() -> SpeedyClient:
    client_class = import_string(settings.SHIPPING_SPEEDY_CLIENT)
    return client_class()
