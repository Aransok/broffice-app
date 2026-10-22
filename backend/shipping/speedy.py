"""Real Speedy REST client (https://api.speedy.bg/web-api.html). Auth is the
username/password inside every JSON body — no headers. Errors come back as
HTTP 200 with an `error` key, so they are checked in the body.

Selected by SHIPPING_SPEEDY_CLIENT; the mock stays the default so dev/test
need no credentials.
"""

import re
from decimal import Decimal

import requests
from django.conf import settings

from common.currency import bgn_to_eur

from .models import SpeedyOffice
from .services import SpeedyClient

SPEEDY_COUNTRY_BG = 100


def _speedy_phone(raw: str) -> str:
    """Speedy wants digits with an optional leading + and a leading 0 or +."""
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("00"):
        return "+" + digits[2:]
    if digits.startswith("359"):
        return "+" + digits
    return digits


class SpeedyAPIError(Exception):
    def __init__(self, message: str, *, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class SpeedyRestClient(SpeedyClient):
    def _post(self, path: str, **body):
        if not (settings.SPEEDY_USERNAME and settings.SPEEDY_PASSWORD):
            raise SpeedyAPIError(
                "SPEEDY_USERNAME/SPEEDY_PASSWORD are not set.", status_code=503
            )
        try:
            response = requests.post(
                f"{settings.SPEEDY_BASE_URL.rstrip('/')}/{path}",
                json={
                    "userName": settings.SPEEDY_USERNAME,
                    "password": settings.SPEEDY_PASSWORD,
                    "language": "BG",
                    **body,
                },
                timeout=30,
            )
        except requests.RequestException as exc:
            raise SpeedyAPIError(f"Speedy is unreachable: {exc}") from exc
        if "json" not in response.headers.get("content-type", ""):
            if response.ok:
                return response  # binary (the PDF label)
            raise SpeedyAPIError(f"HTTP {response.status_code}")
        data = response.json()
        if data.get("error"):
            raise SpeedyAPIError(data["error"].get("message") or "Speedy error")
        return data

    def search_offices(self, city: str, query: str = "") -> list[SpeedyOffice]:
        if not city:
            return []
        sites = self._post("location/site/", countryId=SPEEDY_COUNTRY_BG, name=city)[
            "sites"
        ]
        offices = []
        # A short city name matches many villages; the first few hits are the
        # best matches and keep this to a handful of API calls.
        for site in sites[:3]:
            body = {"siteId": site["id"]}
            if query:
                body["name"] = query
            for office in self._post("location/office/", **body).get("offices", []):
                saved, _ = SpeedyOffice.objects.update_or_create(
                    external_id=str(office["id"]),
                    defaults={
                        "name": office["name"],
                        "city": office["address"]["siteName"],
                        "address": office["address"]["fullAddressString"],
                        "is_active": True,
                    },
                )
                offices.append(saved)
        return offices[:50]

    def get_office(self, external_id: str) -> SpeedyOffice | None:
        # Offices only ever reach checkout via search_offices, which caches them.
        return SpeedyOffice.objects.filter(
            external_id=external_id, is_active=True
        ).first()

    def calculate_price(
        self, *, shipping_method: str, city: str, weight_kg: Decimal | None = None
    ) -> Decimal:
        raise NotImplementedError("Speedy shipping is paid to the courier, not quoted")

    def create_shipment(self, order, *, weight_kg: Decimal) -> dict:
        """Returns {"waybill": str, "label_pdf": bytes}."""
        person = order.customer_name or order.customer_email
        recipient = {
            "phone1": {"number": _speedy_phone(order.customer_phone)},
            "privatePerson": not order.is_company_order,
            "clientName": (
                (order.company_name or person) if order.is_company_order else person
            )[:60],
            "email": order.customer_email,
            "pickupOfficeId": int(order.speedy_office_id),
        }
        if order.is_company_order:
            recipient["contactName"] = person[:60]  # required for companies
        service = {
            "autoAdjustPickupDate": True,
            "serviceId": settings.SPEEDY_SERVICE_ID,
        }
        if order.payment_method == order.PAYMENT_CASH_ON_DELIVERY:
            service["additionalServices"] = {
                "cod": {
                    "amount": float(bgn_to_eur(order.total_bgn)),
                    "currencyCode": "EUR",
                    "processingType": "CASH",
                }
            }
        data = self._post(
            "shipment/",
            sender={
                "phone1": {"number": settings.COMPANY_PHONE},
                "contactName": settings.COMPANY_NAME,
            },
            recipient=recipient,
            service=service,
            content={
                "parcelsCount": 1,
                "contents": "Офис материали",
                "package": "BOX",
                "totalWeight": float(weight_kg),
            },
            # The customer pays Speedy for delivery, same as Pigeon.
            payment={"courierServicePayer": "RECIPIENT"},
            ref1=order.number[:30],
        )
        waybill = data["id"]
        label = self._post(
            "print/", paperSize="A6", parcels=[{"parcel": {"id": waybill}}]
        )
        return {"waybill": waybill, "label_pdf": label.content}
