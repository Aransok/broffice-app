# Speedy courier — real API integration still needed

**Status: mocked, working end-to-end against fake data, never connected to the real Speedy API.**

No real Speedy API credentials or API documentation were available while `backend/shipping/` was built, so nothing here was invented against a guessed API shape — a swappable interface was built instead (`backend/shipping/services.py::SpeedyClient`), with `MockSpeedyClient` as the only implementation, backed by locally seeded `SpeedyOffice` rows (`seed_speedy_offices` management command). Checkout, office search/pricing, and order creation all work correctly today — against the mock.

## What's needed from the client/Speedy

1. A real Speedy API account/credentials (API key or similar — exact auth mechanism unknown until their docs are in hand).
2. Speedy's actual API documentation — office search, price calculation, and shipment creation are three separate concerns and the mock's method signatures (`search_offices`, `get_office`, `calculate_price`, `create_shipment`) are best guesses at what a real client needs to expose, not confirmed against a real spec.

## What still needs building once credentials/docs exist

- A real `SpeedyClient` subclass implementing all four methods against the actual API.
- `SHIPPING_SPEEDY_CLIENT` setting pointed at it (currently defaults to the mock) — this part really is a one-line config change, already designed for that.
- `create_shipment` specifically: **not implemented at all**, even as a mock — it currently just raises `NotImplementedError`. This is the part that actually registers a shipment/generates a waybill with the courier; nothing in the app calls it yet. Needs real design once the API shape is known (does it happen automatically when an admin confirms an order? Manually from the admin panel? What does the app do with the returned waybill number/label?).
- `seed_speedy_offices` currently seeds fake office data — replace with a real sync against Speedy's real office list (likely a scheduled job, similar to the supplier catalog sync).
- Real end-to-end test: a guest checkout picking a real office / real address quote, confirm the price matches what Speedy would actually charge.

## Not blocking today

Checkout fully works right now with mock pricing/offices — this only matters once real orders need to actually ship via Speedy, i.e. after go-live.
