"""Shared branding for outgoing HTML emails (orders, coupons, ...) — one
fixed look regardless of whatever storefront theme preset is selected in a
browser, since email is a separate channel. Logo is embedded as a CID inline
attachment rather than linked by URL, so it renders regardless of whether
the backend is reachable from wherever the recipient opens the email (in
dev it's only reachable at localhost)."""

from email.mime.image import MIMEImage
from pathlib import Path

BRAND_BLUE = "#215F9A"
BRAND_ORANGE = "#EF6E35"
BORDER = "#e2e8f0"
MUTED = "#64748b"

LOGO_PATH = Path(__file__).resolve().parent.parent / "static" / "email" / "logo.png"


def load_logo_image() -> MIMEImage | None:
    if not LOGO_PATH.exists():
        return None
    mime_image = MIMEImage(LOGO_PATH.read_bytes(), _subtype="png")
    mime_image.add_header("Content-ID", "<brand-logo>")
    mime_image.add_header("Content-Disposition", "inline", filename="logo.png")
    return mime_image


def logo_header_html(company_name: str) -> tuple[str, MIMEImage | None]:
    """Returns (html_snippet, image_to_attach_or_None)."""
    logo_image = load_logo_image()
    if logo_image is not None:
        html = (
            f'<img src="cid:brand-logo" height="40" alt="{company_name}" '
            f'style="height:40px;display:block;" />'
        )
    else:
        html = (
            f'<span style="color:{BRAND_BLUE};font-size:20px;font-weight:700;">'
            f"{company_name}</span>"
        )
    return html, logo_image
