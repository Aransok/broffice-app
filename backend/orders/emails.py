"""HTML order-email rendering: styled tables + inline product thumbnails.

Product images are embedded as CID inline attachments rather than linked by
URL — in dev the backend is only reachable at localhost, so a normal
`<img src="http://localhost:8000/...">` would just show a broken image icon
for anyone opening the email on a different machine (which is exactly how
this gets tested — two separate Gmail accounts). Embedding the actual bytes
means the image always renders regardless of network reachability, the same
principle as attaching the PDF invoice rather than linking to it.

Brand colors are the client's real logo colors (docs: BR primary blue,
orange accent), not whatever storefront theme preset happens to be selected
in a browser — email is a separate channel with one fixed look.
"""

import mimetypes
from email.mime.image import MIMEImage

from django.conf import settings

from common.currency import format_both_currencies as _both_currencies
from common.emails import BORDER, BRAND_BLUE, BRAND_ORANGE, MUTED, logo_header_html
from common.media import resolve_media_path

SHIPPING_METHOD_LABELS = {
    "speedy_address": "Доставка до адрес",
    "speedy_office": "До офис на Спиди",
}


def _load_item_images(order) -> dict[str, MIMEImage]:
    """One inline MIMEImage per order item that has a real, readable image
    file on this disk — items with no image, or a legacy path with no
    HTTRACK_ROOT configured, are simply omitted (fallback square in the
    template), never a broken link or a crash."""
    inline_images: dict[str, MIMEImage] = {}
    for idx, item in enumerate(order.items.all()):
        if item.product_id is None:
            continue
        image = item.product.images.first()
        if image is None:
            continue
        path = resolve_media_path(image.path)
        if path is None:
            continue
        content_type, _ = mimetypes.guess_type(path.name)
        subtype = (content_type or "image/png").split("/")[-1]
        data = path.read_bytes()
        mime_image = MIMEImage(data, _subtype=subtype)
        cid = f"item-image-{idx}"
        mime_image.add_header("Content-ID", f"<{cid}>")
        mime_image.add_header("Content-Disposition", "inline", filename=path.name)
        inline_images[str(item.id)] = mime_image
        # Attribute used below to look the cid back up per item without a
        # second dict keyed differently.
        mime_image.cid = cid  # type: ignore[attr-defined]
    return inline_images


def _delivery_line(order) -> str:
    if not order.shipping_method:
        return ""
    label = SHIPPING_METHOD_LABELS.get(order.shipping_method, order.shipping_method)
    if order.shipping_method == "speedy_office":
        return f"{label} — {order.speedy_office_name}"
    return f"{label} — {order.delivery_address_line}, {order.delivery_city} {order.delivery_post_code}".strip()


def render_order_email_html(
    order,
    *,
    heading: str,
    intro: str,
    cta_url: str | None = None,
    cta_label: str | None = None,
    promo_note: str | None = None,
    show_profit: bool = False,
) -> tuple[str, list[MIMEImage]]:
    """Returns (html, inline_images_to_attach). Caller attaches the images to
    the EmailMultiAlternatives and sets mixed_subtype='related'.

    show_profit adds a per-item + total profit column — admin-eyes-only.
    Callers must only pass True for admin-facing emails (send_admin_order_email,
    send_admin_confirmation_email), never the shared customer-facing path."""
    inline_images = _load_item_images(order)
    logo_html, logo_image = logo_header_html(settings.COMPANY_NAME)

    rows = []
    for item in order.items.all():
        mime_image = inline_images.get(str(item.id))
        if mime_image is not None:
            img_html = (
                f'<img src="cid:{mime_image.cid}" width="48" height="48" '
                f'style="width:48px;height:48px;object-fit:contain;border:1px solid {BORDER};'
                f'border-radius:6px;background:#f8fafc;" alt="" />'
            )
        else:
            img_html = (
                f'<div style="width:48px;height:48px;border:1px solid {BORDER};border-radius:6px;'
                f'background:#f8fafc;"></div>'
            )
        sku_html = (
            f'<div style="color:{MUTED};font-size:12px;">SKU: {item.product_sku}</div>'
            if item.product_sku
            else ""
        )
        discount_html = (
            f'<div style="color:{BRAND_ORANGE};font-size:12px;">{item.discount_label}</div>'
            if item.discount_label
            else ""
        )
        profit_cell_html = (
            f'<td style="padding:8px;border-bottom:1px solid {BORDER};text-align:right;color:#15803d;">'
            f'{_both_currencies(item.profit_bgn) if item.profit_bgn is not None else "-"}</td>'
            if show_profit
            else ""
        )
        rows.append(f"""
            <tr>
              <td style="padding:8px;border-bottom:1px solid {BORDER};">{img_html}</td>
              <td style="padding:8px;border-bottom:1px solid {BORDER};">
                <div style="font-weight:600;color:#0f172a;">{item.product_name}</div>
                {sku_html}{discount_html}
              </td>
              <td style="padding:8px;border-bottom:1px solid {BORDER};text-align:center;color:#0f172a;">{item.quantity}</td>
              <td style="padding:8px;border-bottom:1px solid {BORDER};text-align:right;color:#0f172a;">{_both_currencies(item.unit_price)}</td>
              <td style="padding:8px;border-bottom:1px solid {BORDER};text-align:right;font-weight:600;color:#0f172a;">{_both_currencies(item.line_total)}</td>
              {profit_cell_html}
            </tr>
            """)
    profit_header_html = (
        f'<th style="padding:8px;text-align:right;font-size:12px;color:{MUTED};">Печалба</th>'
        if show_profit
        else ""
    )
    total_profit_row_html = (
        f'<tr><td style="padding:8px 0;font-weight:700;color:#15803d;">Обща печалба</td>'
        f'<td style="padding:8px 0;text-align:right;font-weight:700;color:#15803d;">'
        f"{_both_currencies(order.total_profit_bgn)}</td></tr>"
        if show_profit and order.total_profit_bgn is not None
        else ""
    )

    promo_note_html = (
        f'<p style="margin:0 0 16px;padding:12px 16px;background:#fff7ed;'
        f'border:1px solid {BRAND_ORANGE};border-radius:8px;color:#0f172a;">{promo_note}</p>'
        if promo_note
        else ""
    )
    shipping_row = (
        f'<tr><td style="padding:4px 0;color:{MUTED};">Доставка</td>'
        f'<td style="padding:4px 0;text-align:right;">{_both_currencies(order.shipping_cost_bgn)}</td></tr>'
        if order.shipping_cost_bgn
        else ""
    )
    coupon_row = (
        f'<tr><td style="padding:4px 0;color:{BRAND_ORANGE};">Купон ({order.coupon_code})</td>'
        f'<td style="padding:4px 0;text-align:right;color:{BRAND_ORANGE};">'
        f"-{_both_currencies(order.coupon_discount_bgn)}</td></tr>"
        if order.coupon_discount_bgn
        else ""
    )
    delivery_line = _delivery_line(order)
    cta_html = (
        f"""
        <tr>
          <td style="padding:24px 0 8px;text-align:center;">
            <a href="{cta_url}" style="background:{BRAND_BLUE};color:#ffffff;text-decoration:none;
              padding:12px 28px;border-radius:8px;font-weight:600;display:inline-block;">
              {cta_label}
            </a>
          </td>
        </tr>
        """
        if cta_url
        else ""
    )

    return (
        f"""
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="background:#ffffff;padding:20px 24px;border:1px solid {BORDER};
                border-bottom:3px solid {BRAND_BLUE};border-radius:8px 8px 0 0;">
                {logo_html}
              </td>
            </tr>
            <tr>
              <td style="padding:24px;border:1px solid {BORDER};border-top:none;">
                <h1 style="margin:0 0 8px;font-size:18px;color:#0f172a;">{heading}</h1>
                <p style="margin:0 0 16px;color:{MUTED};">{intro}</p>
                {promo_note_html}
                <p style="margin:0 0 16px;font-size:13px;color:{MUTED};">
                  Поръчка <strong style="color:#0f172a;">{order.number}</strong> ·
                  {order.created_at.strftime('%d.%m.%Y %H:%M')}
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;">
                  <thead>
                    <tr style="background:#f8fafc;">
                      <th style="padding:8px;text-align:left;font-size:12px;color:{MUTED};">Снимка</th>
                      <th style="padding:8px;text-align:left;font-size:12px;color:{MUTED};">Продукт</th>
                      <th style="padding:8px;text-align:center;font-size:12px;color:{MUTED};">Кол-во</th>
                      <th style="padding:8px;text-align:right;font-size:12px;color:{MUTED};">Ед. цена</th>
                      <th style="padding:8px;text-align:right;font-size:12px;color:{MUTED};">Общо</th>
                      {profit_header_html}
                    </tr>
                  </thead>
                  <tbody>{''.join(rows)}</tbody>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
                  <tr><td style="padding:4px 0;color:{MUTED};">Междинна сума</td>
                    <td style="padding:4px 0;text-align:right;">{_both_currencies(order.subtotal_bgn)}</td></tr>
                  {shipping_row}
                  {coupon_row}
                  <tr><td style="padding:4px 0;color:{MUTED};">ДДС ({order.vat_rate_percent}%)</td>
                    <td style="padding:4px 0;text-align:right;">{_both_currencies(order.vat_amount_bgn)}</td></tr>
                  <tr><td style="padding:8px 0;font-weight:700;color:#0f172a;border-top:1px solid {BORDER};">Общо</td>
                    <td style="padding:8px 0;text-align:right;font-weight:700;color:{BRAND_ORANGE};border-top:1px solid {BORDER};">{_both_currencies(order.total_bgn)}</td></tr>
                  {total_profit_row_html}
                </table>

                {f'<p style="margin:16px 0 0;font-size:13px;color:{MUTED};">{delivery_line}</p>' if delivery_line else ''}
                {cta_html}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;color:{MUTED};font-size:12px;border:1px solid {BORDER};border-top:none;border-radius:0 0 8px 8px;">
                {settings.COMPANY_NAME} · {settings.COMPANY_ADDRESS}<br />
                {settings.COMPANY_EMAIL} · {settings.COMPANY_PHONE}
              </td>
            </tr>
          </table>
        </div>
        """,
        ([logo_image] if logo_image is not None else []) + list(inline_images.values()),
    )
