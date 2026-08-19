import logging
import secrets
import re

import requests as http_requests
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.hashers import make_password, check_password
from django.core.cache import cache
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Profile

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Google OAuth
# ---------------------------------------------------------------------------

class GoogleAuthError(Exception):
    """Raised when Google token verification fails."""
def google_login(token: str) -> dict:
    """
    Verify a Google OAuth access token and return a
    dict with JWT tokens + basic user info.

    Raises:
        GoogleAuthError: if the token is invalid or the request fails.
    """
    try:
        response = http_requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if not response.ok:
            raise GoogleAuthError("Invalid token")
        idinfo = response.json()

        email = idinfo["email"].strip().lower() if idinfo.get("email") else ""
        first_name = idinfo.get("given_name", "")
        last_name = idinfo.get("family_name", "")

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            user = User.objects.create(
                username=email,
                email=email,
                first_name=first_name,
                last_name=last_name,
            )
            user.set_unusable_password()
            user.save()
            
            try:
                from apps.notifications.services import NotificationService
                NotificationService.send_welcome_email(user)
            except Exception:
                logger.exception("Failed to send welcome email on Google login")

        # Ensure profile exists
        Profile.objects.get_or_create(user=user)

        refresh = RefreshToken.for_user(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.profile.role,
        }

    except GoogleAuthError:
        raise
    except Exception as exc:
        logger.exception("Google login failed")
        raise GoogleAuthError(f"Google login failed: {exc}") from exc


# ---------------------------------------------------------------------------
# OTP helpers (shared between password-reset and email-change flows)
# ---------------------------------------------------------------------------

def _generate_otp() -> str:
    """Return a random 6-digit OTP string."""
    return f"{secrets.randbelow(1000000):06d}"


# ---------------------------------------------------------------------------
# Password-reset OTP flow
# ---------------------------------------------------------------------------

def send_password_reset_otp(email: str) -> None:
    """
    Generate a 6-digit OTP for password reset, cache it (5 min TTL),
    and dispatch an e-mail to *email*.

    Does nothing silently if the e-mail doesn't belong to any user
    (caller should always return 200 to avoid e-mail enumeration).
    """
    if email:
        email = email.strip().lower()
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return

    from apps.notifications.services import NotificationService
    otp = _generate_otp()
    cache_key = f"pwd_reset_otp_{email}"
    cache.set(cache_key, make_password(otp), timeout=300)

    try:
        NotificationService.send_password_reset_otp(email, otp)
    except Exception:
        logger.exception("Error building password-reset e-mail")


def reset_password(email: str, otp: str, new_password: str) -> bool:
    """
    Validate the OTP and, if valid, set *new_password* for the user.

    Returns True on success, False if the OTP is invalid/expired.
    """
    if email:
        email = email.strip().lower()
    cache_key = f"pwd_reset_otp_{email}"
    attempts_key = f"{cache_key}_attempts"
    cached_hashed_otp = cache.get(cache_key)

    attempts = cache.get(attempts_key, 0)
    if attempts >= 5:
        cache.delete(cache_key)
        cache.delete(attempts_key)
        return False

    if not cached_hashed_otp or not check_password(otp, cached_hashed_otp):
        cache.set(attempts_key, attempts + 1, timeout=300)
        return False

    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return False

    user.set_password(new_password)
    user.save()
    cache.delete(cache_key)
    cache.delete(f"pwd_reset_otp_{email}_attempts")
    return True


# ---------------------------------------------------------------------------
# Change password (authenticated user)
# ---------------------------------------------------------------------------

def change_password(user: User, old_password: str, new_password: str) -> bool:
    """
    Verify *old_password* and update to *new_password*.
    If user does not have a usable password, skip old_password check.

    Returns True on success, False if old_password is wrong.
    """
    if user.has_usable_password():
        if not user.check_password(old_password):
            return False
    user.set_password(new_password)
    user.save()
    return True


# ---------------------------------------------------------------------------
# Email-change OTP flow
# ---------------------------------------------------------------------------

def send_email_change_otp(user: User, new_email: str) -> None:
    """
    Generate a 6-digit OTP for e-mail change, cache it (5 min TTL),
    and dispatch an e-mail to *new_email*.
    """
    from apps.notifications.services import NotificationService
    if User.objects.filter(email__iexact=new_email).exclude(pk=user.pk).exists():
        return

    otp = _generate_otp()
    cache_key = f"email_otp_{user.id}_{new_email}"
    cache.set(cache_key, make_password(otp), timeout=300)

    try:
        NotificationService.send_email_change_otp(new_email, otp)
    except Exception:
        logger.exception("Error building email-change e-mail")


def verify_email_change_otp(user: User, new_email: str, otp: str) -> bool:
    """
    Validate the OTP and, if valid, update the user's e-mail address.

    Returns True on success, False if the OTP is invalid/expired.
    """
    cache_key = f"email_otp_{user.id}_{new_email}"
    attempts_key = f"{cache_key}_attempts"
    cached_hashed_otp = cache.get(cache_key)

    attempts = cache.get(attempts_key, 0)
    if attempts >= 5:
        cache.delete(cache_key)
        cache.delete(attempts_key)
        return False

    if not cached_hashed_otp or not check_password(otp, cached_hashed_otp):
        cache.set(attempts_key, attempts + 1, timeout=300)
        return False

    if User.objects.filter(email__iexact=new_email).exclude(pk=user.pk).exists():
        return False

    user.email = new_email
    user.save()
    cache.delete(cache_key)
    cache.delete(f"email_otp_{user.id}_{new_email}_attempts")
    return True