import logging

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMultiAlternatives
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from common.emails import BORDER, BRAND_BLUE, MUTED, logo_header_html

logger = logging.getLogger(__name__)


def request_password_reset(email: str) -> None:
    """Sends a reset link if (and only if) the email matches a real account —
    but the caller must always respond the same way regardless, so this
    function never reveals whether a match was found (avoids user/account
    enumeration via the forgot-password form). A send failure is logged
    (previously `fail_silently=True` swallowed it with zero trace anywhere —
    an SMTP outage would have looked identical to a correctly-sent email)
    but still doesn't change the response, for the same anti-enumeration
    reason."""
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if not user:
        return
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link = f"{settings.FRONTEND_BASE_URL}/reset-password/{uid}/{token}/"

    text_body = (
        f"За да зададете нова парола, отворете следния линк (валиден за ограничено "
        f"време, само за еднократна употреба):\n\n{link}\n\n"
        f"Ако не сте заявили това, просто игнорирайте това съобщение."
    )
    logo_html, logo_image = logo_header_html(settings.COMPANY_NAME)
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
          <td style="padding:24px;border:1px solid {BORDER};border-top:none;border-radius:0 0 8px 8px;">
            <h1 style="margin:0 0 12px;font-size:18px;color:#0f172a;">Възстановяване на парола</h1>
            <p style="margin:0 0 20px;color:{MUTED};">
              За да зададете нова парола, натиснете бутона по-долу. Линкът е валиден за
              ограничено време и само за еднократна употреба.
            </p>
            <p style="text-align:center;margin:0 0 20px;">
              <a href="{link}" style="background:{BRAND_BLUE};color:#ffffff;text-decoration:none;
                padding:12px 28px;border-radius:8px;font-weight:600;display:inline-block;">
                Задайте нова парола
              </a>
            </p>
            <p style="margin:0;font-size:12px;color:{MUTED};">
              Ако не сте заявили това, просто игнорирайте това съобщение.
            </p>
          </td>
        </tr>
      </table>
    </div>
    """

    try:
        message = EmailMultiAlternatives(
            "Възстановяване на парола",
            text_body,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
        )
        message.attach_alternative(html_body, "text/html")
        if logo_image is not None:
            message.mixed_subtype = "related"
            message.attach(logo_image)
        message.send(fail_silently=False)
    except Exception:
        logger.exception("Password reset email failed to send to %s", user.email)


def get_user_from_uid(uidb64: str) -> User | None:
    try:
        pk = urlsafe_base64_decode(uidb64).decode()
        return User.objects.get(pk=pk)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None


def confirm_password_reset(uidb64: str, token: str, new_password: str) -> bool:
    """Returns False for any invalid/expired/already-used token — the
    generator ties the token to the user's current password hash and
    last_login, so it becomes invalid the moment it's used once."""
    user = get_user_from_uid(uidb64)
    if user is None or not default_token_generator.check_token(user, token):
        return False
    user.set_password(new_password)
    user.save(update_fields=["password"])
    return True
