import logging

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

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
    try:
        send_mail(
            "Възстановяване на парола",
            f"За да зададете нова парола, отворете следния линк (валиден за ограничено "
            f"време, само за еднократна употреба):\n\n{link}\n\n"
            f"Ако не сте заявили това, просто игнорирайте това съобщение.",
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
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
