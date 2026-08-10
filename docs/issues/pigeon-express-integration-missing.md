# Pigeon Express courier — not built at all yet

**Status: does not exist anywhere in the codebase.** Confirmed by a full-repo search — no model, no client, no checkout option, no admin field references Pigeon Express. The only courier implemented (even as a mock) is Speedy — see [[speedy-real-integration-needed]].

The client asked (2026-08-10) for Pigeon Express to be available as a second shipping option once the site is deployed. This is net-new development, not a config change — the current architecture only models a single courier's shape (`Order.shipping_method` choices are `speedy_address`/`speedy_office` only; `backend/shipping/` is named and structured around Speedy specifically).

## What's needed from the client/Pigeon Express first

Same category of unknowns as Speedy, never guessed at:

1. Real Pigeon Express API credentials.
2. Their API documentation — office/pickup-point search (if they have physical offices the way Speedy does), price calculation, shipment creation.

## What building this actually involves, once docs/credentials exist

- A `PigeonClient` following the same interface shape as `SpeedyClient` (`backend/shipping/services.py`) — the abstract-base-class pattern here was already designed to support more than one courier, so this part is additive, not a rewrite.
- `Order.shipping_method` needs new choices (e.g. `pigeon_address`/`pigeon_office`) — a real migration, not just a settings change.
- A `PigeonOffice` model if they have pickup-point infrastructure like Speedy's `SpeedyOffice` (unknown until their docs are reviewed — they might not have this concept at all, e.g. address-only delivery).
- Checkout UI: the courier picker currently only ever offers Speedy — needs a second option, with its own office picker if applicable (mirrors `frontend/src/pages/CheckoutPage.tsx`'s existing Speedy step).
- Admin panel: wherever Speedy shipping details are shown for an order (order detail/notifications page) needs the same for Pigeon orders.
- Pricing: `orders/services.py::recalc_order_total` already adds `shipping_cost_bgn` generically, which should work unchanged — the courier-specific part is only in *how* that number gets calculated.

## Not blocking today

Nothing depends on this yet — Speedy alone is what's checked out against right now (via the mock). This becomes real work once Pigeon Express credentials/docs are in hand.
