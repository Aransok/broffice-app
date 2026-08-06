import re

from django.conf import settings

_SIMPLE_TOKENS = {
    "{{COMPANY_NAME}}": lambda: settings.COMPANY_NAME,
    "{{COMPANY_EIK}}": lambda: settings.COMPANY_EIK,
    "{{COMPANY_ADDRESS}}": lambda: settings.COMPANY_ADDRESS,
    "{{COMPANY_EMAIL}}": lambda: settings.COMPANY_EMAIL,
    "{{COMPANY_PHONE}}": lambda: settings.COMPANY_PHONE,
    "{{COMPANY_WORKING_HOURS}}": lambda: settings.COMPANY_WORKING_HOURS,
    "{{VAT_RATE_PERCENT}}": lambda: str(settings.VAT_RATE_PERCENT),
}

# A whole-line placeholder: `{{COMPANY_VAT_LINE}}` on its own line is replaced
# by a real "ДДС номер: ..." line (including its newline) when a VAT number
# is configured, or removed entirely — newline and all — when it isn't, so
# no stray blank line or "ДДС номер: " with nothing after it ever reaches a
# customer (spec: "do not display a fake/empty VAT number anywhere").
_VAT_LINE_PATTERN = re.compile(r"^\{\{COMPANY_VAT_LINE\}\}\n?", re.MULTILINE)


def render_page_body(body: str) -> str:
    """Resolves company-fact tokens against current settings at read time —
    not baked in at seed-migration time — so changing an env var (most
    importantly COMPANY_VAT_NUMBER) takes effect immediately without needing
    to re-edit every legal page's stored text."""
    vat_number = settings.COMPANY_VAT_NUMBER
    vat_line = f"ДДС номер: {vat_number}\n" if vat_number else ""
    body = _VAT_LINE_PATTERN.sub(vat_line, body)
    for token, getter in _SIMPLE_TOKENS.items():
        if token in body:
            body = body.replace(token, getter())
    return body
