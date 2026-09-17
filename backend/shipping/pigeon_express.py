"""Pigeon Express courier integration — real API access (sandbox or
production, per PIGEON_EXPRESS_BASE_URL), unlike the Speedy integration in
shipping/services.py, which has never had real API credentials and stays a
mock. There is deliberately no mock implementation here — only
PigeonExpressClient. get_pigeon_express_client() is a plain factory kept
purely as a test seam (mock.patch this, not a network call), not a
settings-driven swap like Speedy's SHIPPING_SPEEDY_CLIENT — there's nothing
else to swap to in production.

Endpoints deliberately not implemented (out of scope for v1): GET
/additional-services, POST /shipments/track/bulk, GET /shipments/{ref}/label
(the base64 label from create_shipment is stored instead), GET
/shipment-statuses, Courier Requests, Payments/COD payouts.
"""

from __future__ import annotations

import requests
from django.conf import settings


class PigeonExpressAPIError(Exception):
    """Raised for any non-2xx response. `errors` is the field-keyed 422
    validation envelope when present (see API docs' ValidationError shape),
    None otherwise (missing/malformed body, or a business-rule 422 that only
    carries `message`)."""

    def __init__(self, message: str, *, status_code: int, errors: dict | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.errors = errors


class PigeonExpressNotConfigured(Exception):
    pass


class PigeonExpressClient:
    def __init__(self) -> None:
        base_url = settings.PIGEON_EXPRESS_BASE_URL
        if not base_url:
            raise PigeonExpressNotConfigured(
                "PIGEON_EXPRESS_BASE_URL is not set — add it (and "
                "PIGEON_EXPRESS_API_KEY/PIGEON_EXPRESS_API_SECRET) to .env "
                "before using the Pigeon Express integration."
            )
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update(
            {
                "X-API-Key": settings.PIGEON_EXPRESS_API_KEY,
                "X-API-Secret": settings.PIGEON_EXPRESS_API_SECRET,
            }
        )

    def _request(self, method: str, path: str, *, params=None, json=None) -> dict:
        response = self.session.request(
            method, f"{self.base_url}{path}", params=params, json=json, timeout=30
        )
        try:
            body = response.json()
        except ValueError:
            body = None
        if not response.ok:
            message = (body or {}).get("message") or f"HTTP {response.status_code}"
            errors = (body or {}).get("errors")
            raise PigeonExpressAPIError(
                message, status_code=response.status_code, errors=errors
            )
        return body or {}

    def _paginated(self, method: str, path: str, *, params=None) -> dict:
        body = self._request(method, path, params=params)
        return {"results": body.get("data") or [], "meta": body.get("meta") or {}}

    def search_cities(
        self, *, name: str = "", postal_code: str = "", page: int = 1, per_page: int = 20
    ) -> dict:
        return self._paginated(
            "GET",
            "/cities",
            params={"name": name, "postal_code": postal_code, "page": page, "per_page": per_page},
        )

    def get_city(self, city_id) -> dict | None:
        try:
            return self._request("GET", f"/cities/{city_id}")["data"]
        except PigeonExpressAPIError as exc:
            if exc.status_code == 404:
                return None
            raise

    def search_streets(
        self, city_id, *, name: str = "", page: int = 1, per_page: int = 20
    ) -> dict:
        # The real API 422s on a `name` shorter than 2 chars — skip the call
        # entirely for a shorter query instead of guaranteeing an error on
        # every first keystroke of a search-as-you-type field.
        if len(name) < 2:
            return {"results": [], "meta": {}}
        return self._paginated(
            "GET",
            f"/cities/{city_id}/streets",
            params={"name": name, "page": page, "per_page": per_page},
        )

    def search_offices(
        self,
        *,
        type: str = "office",
        name: str = "",
        city_id: str = "",
        postal_code: str = "",
        page: int = 1,
        per_page: int = 20,
    ) -> dict:
        return self._paginated(
            "GET",
            "/offices",
            params={
                "type": type,
                "name": name,
                "city_id": city_id,
                "postal_code": postal_code,
                "page": page,
                "per_page": per_page,
            },
        )

    def get_office(self, office_id) -> dict | None:
        try:
            return self._request("GET", f"/offices/{office_id}")["data"]
        except PigeonExpressAPIError as exc:
            if exc.status_code == 404:
                return None
            raise

    def calculate_shipping_cost(
        self,
        *,
        pickup: dict,
        delivery: dict,
        packages: list[dict],
        service_type: str = "standard",
        who_pays: str = "sender",
        service_codes: dict | None = None,
    ) -> dict:
        payload = {
            **pickup,
            **delivery,
            "packages": packages,
            "service_type": service_type,
            "who_pays": who_pays,
        }
        if service_codes:
            payload["service_codes"] = service_codes
        return self._request("POST", "/shipments/calculate", json=payload)["data"]

    def create_shipment(
        self,
        *,
        receiver_name: str,
        receiver_phone: str,
        pickup: dict,
        delivery: dict,
        packages: list[dict],
        inventory_items: list[dict],
        receiver_email: str = "",
        service_type: str = "standard",
        who_pays: str = "sender",
        note: str = "",
        external_reference: str = "",
        label_format: str = "default",
        service_codes: dict | None = None,
    ) -> dict:
        payload = {
            "receiver_name": receiver_name,
            "receiver_phone": receiver_phone,
            **pickup,
            **delivery,
            "packages": packages,
            "service_type": service_type,
            "who_pays": who_pays,
            "inventory_items": inventory_items,
            "label_format": label_format,
        }
        if receiver_email:
            payload["receiver_email"] = receiver_email
        if note:
            payload["note"] = note
        if external_reference:
            payload["external_reference"] = external_reference
        if service_codes:
            payload["service_codes"] = service_codes
        return self._request("POST", "/shipments", json=payload)["data"]

    def get_shipment(self, reference_number: str) -> dict | None:
        try:
            return self._request("GET", f"/shipments/{reference_number}")["data"]
        except PigeonExpressAPIError as exc:
            if exc.status_code == 404:
                return None
            raise

    def track_shipment(self, reference_number: str) -> dict | None:
        try:
            return self._request("GET", f"/shipments/{reference_number}/track")["data"]
        except PigeonExpressAPIError as exc:
            if exc.status_code == 404:
                return None
            raise

    def cancel_shipment(self, reference_number: str) -> dict:
        return self._request("POST", f"/shipments/{reference_number}/cancel")["data"]


def get_pigeon_express_client() -> PigeonExpressClient:
    return PigeonExpressClient()
