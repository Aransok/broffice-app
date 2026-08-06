# Legal/business information still needed from the client

None of the items below have been invented anywhere in the codebase — every place one of these facts would appear either omits it entirely (VAT number) or states honestly that the specific value is pending confirmation (return period, retention period, refund timing). This file is the single checklist of what's still needed before the legal pages/invoices can be considered final.

## 1. VAT registration number

**Status: not configured, not displayed anywhere.**

- Setting: `COMPANY_VAT_NUMBER` (env var), defaults to `""` in `backend/config/settings.py`.
- Wherever it would appear — invoice PDF (`orders/pdf.py`), invoice email (`orders/services.py`), Terms & Conditions / Privacy Policy company-identification sections (`pages/services.py::render_page_body`), footer, contact page — the code checks `if settings.COMPANY_VAT_NUMBER:` (or the equivalent `{{COMPANY_VAT_LINE}}` template token) and shows **nothing** if it's empty. No placeholder text, no fake number.
- **Action needed**: once you confirm VAT-registration status, set `COMPANY_VAT_NUMBER=BG...` (or whatever the real number is) in the deployment environment. It will then appear automatically everywhere it's relevant — no code change required.

## 2. Return / withdrawal period

**Status: general legal right described, exact company-specific timeframe not stated.**

- Location: `pages/migrations/0003_update_legal_pages.py` — the `RETURNS_AND_WITHDRAWAL` and `TERMS_AND_CONDITIONS` content.
- Current wording explains the general legal right of withdrawal under Bulgarian consumer-protection law (ЗЗП) but explicitly says the exact window and specific conditions are "predстои да бъдат потвърдени" (pending confirmation) rather than stating a number of days.
- **Action needed**: confirm the actual return window your business intends to honor (the ЗЗП statutory minimum for consumers is commonly 14 days, but this must come from you, not be assumed) and any category-specific exceptions. Once confirmed, this needs a manual edit to the `Page` row (via Django admin, or another migration) — it does not auto-update from a setting, since it's prose, not a single fact.

## 3. Refund timing/method

**Status: general legal principle stated, no specific timeframe or mechanism.**

- Same pages as above — "Възстановяване на суми" sections say a refund will be processed "съгласно приложимото законодателство" without committing to a specific number of days or method (bank transfer vs. reversing the cash-on-delivery payment, etc.).
- **Action needed**: confirm your intended refund process and timing.

## 4. Data retention period (Privacy Policy)

**Status: general principle stated (retained as long as necessary + legal minimums for financial records), no specific duration given.**

- Location: Privacy Policy's "Съхранение на данните" section.
- **Action needed**: if you have (or want to set) a specific retention period for account data, order history, or contact-form messages beyond the legally-mandated minimum for financial records, provide it.

## 5. Self-registration — confirm this is wanted

Not missing information exactly, but flagging: self-registration was just built (this session) at the client's explicit request. If this wasn't actually wanted, or if additional fields/consent language are needed, let us know — it's new and easy to adjust.

## What does NOT need anything from you (already handled correctly)

- Company name, EIK, address, email, phone, working hours — all in use everywhere via `COMPANY_NAME`/`COMPANY_EIK`/`COMPANY_ADDRESS`/`COMPANY_EMAIL`/`COMPANY_PHONE`/`COMPANY_WORKING_HOURS` settings.
- VAT rate (20%, Bulgaria's public statutory rate — not a business-specific fact, safe to default) — `VAT_RATE_PERCENT` setting, shown consistently everywhere prices are shown.
- Payment method (cash-on-delivery only) — this is what's actually implemented, stated as such, no other method claimed.
- Delivery method (Speedy, office or address) — this is what's actually implemented.
