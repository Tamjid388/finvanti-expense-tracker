"""Google ID-token verification + username derivation (server-verified only)."""

from django.conf import settings
from django.contrib.auth.models import User
from django.utils.text import slugify
from rest_framework.exceptions import AuthenticationFailed


def verify_google_id_token(id_token: str) -> dict:
    """Verify a Google ID token and return {sub, email, email_verified}.

    Raises AuthenticationFailed on any invalid token. Never trust client email.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise AuthenticationFailed("Google sign-in is not configured.", code="not_configured")
    if not id_token:
        raise AuthenticationFailed("Invalid or expired Google token.", code="invalid_token")
    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token

        payload = google_id_token.verify_oauth2_token(
            id_token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
    except ValueError as exc:
        raise AuthenticationFailed("Invalid or expired Google token.", code="invalid_token") from exc
    except ImportError as exc:
        # Missing server transport (e.g. `requests` not installed) — distinct
        # from a missing GOOGLE_CLIENT_ID so misdiagnosis is impossible.
        raise AuthenticationFailed("Google sign-in is temporarily unavailable.", code="server_misconfigured") from exc

    if payload.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise AuthenticationFailed("Invalid or expired Google token.", code="invalid_token")
    if payload.get("email_verified") is not True:
        raise AuthenticationFailed("Google email is not verified.", code="email_not_verified")
    sub = payload.get("sub")
    email = (payload.get("email") or "").strip().lower()
    if not sub or not email:
        raise AuthenticationFailed("Invalid or expired Google token.", code="invalid_token")
    return {"sub": sub, "email": email, "email_verified": True}


def derive_username(email: str) -> str:
    """Derive a unique Django username from an email address."""
    base = slugify(email.split("@")[0])[:30] or "user"
    username = base
    counter = 1
    while User.objects.filter(username__iexact=username).exists():
        counter += 1
        suffix = f"_{counter}"
        username = f"{base[: 30 - len(suffix)]}{suffix}"
    return username
