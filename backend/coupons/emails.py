"""Styled HTML email announcing a coupon a customer was just given —
separate from orders/emails.py (no items table, different trigger), same
brand look via common/emails.py."""

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

from common.currency import format_eur
from common.emails import BORDER, BRAND_BLUE, BRAND_ORANGE, MUTED, logo_header_html

from .models import Coupon


def _discount_text(coupon: Coupon) -> str:
    if coupon.discount_type == Coupon.TYPE_PERCENT:
        return f"{coupon.value}%"
    return format_eur(coupon.value)


def send_coupon_email(coupon: Coupon) -> bool:
    """Only ever called for a customer-specific coupon (coupon.user set) —
    a general/public code has no one particular person to email. Returns
    whether it actually sent, so callers can decide how to report failure
    without ever crashing the admin action that created the coupon."""
    if coupon.user_id is None or not coupon.user.email:
        return False

    logo_html, logo_image = logo_header_html(settings.COMPANY_NAME)
    discount_text = _discount_text(coupon)
    subject = f"Купон за вас: {discount_text} отстъпка"

    text_body = (
        f"Здравейте,\n\n"
        f"Получихте купон код за отстъпка {discount_text} от цялата поръчка: {coupon.code}\n\n"
        f"Въведете го при плащане на следващата ви поръчка. Валиден е за еднократна употреба.\n\n"
        f"{settings.COMPANY_NAME}\n"
        f"{settings.COMPANY_EMAIL} · {settings.COMPANY_PHONE}\n"
    )

    html_body = f"""
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="background:#ffffff;padding:20px 24px;border:1px solid {BORDER};
            border-bottom:3px solid {BRAND_BLUE};border-radius:8px 8px 0 0;">
            {logo_html}
          </td>
        </tr>
        <tr>
          <td style="padding:24px;border:1px solid {BORDER};border-top:none;border-radius:0 0 8px 8px;text-align:center;">
            <p style="margin:0 0 8px;color:{MUTED};">Като благодарност, че ни избрахте:</p>
            <p style="margin:0 0 16px;font-size:28px;font-weight:700;color:{BRAND_ORANGE};">
              -{discount_text} отстъпка
            </p>
            <p style="margin:0 0 16px;color:{MUTED};">Използвайте купон кода при плащане:</p>
            <p style="margin:0 0 20px;padding:12px 20px;background:#f8fafc;border:1px dashed {BRAND_BLUE};
              border-radius:8px;display:inline-block;font-size:20px;font-weight:700;
              letter-spacing:2px;color:{BRAND_BLUE};">
              {coupon.code}
            </p>
            <p style="margin:0;font-size:12px;color:{MUTED};">
              Валиден е за еднократна употреба върху цялата поръчка.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;color:{MUTED};font-size:12px;">
            {settings.COMPANY_NAME} · {settings.COMPANY_EMAIL} · {settings.COMPANY_PHONE}
          </td>
        </tr>
      </table>
    </div>
    """

    message = EmailMultiAlternatives(
        subject, text_body, settings.DEFAULT_FROM_EMAIL, [coupon.user.email]
    )
    message.attach_alternative(html_body, "text/html")
    if logo_image is not None:
        message.mixed_subtype = "related"
        message.attach(logo_image)
    message.send(fail_silently=False)
    return True
