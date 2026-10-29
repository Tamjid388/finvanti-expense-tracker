"""httpOnly refresh-token cookie helpers (single place for cookie attrs)."""

from django.conf import settings


def cookie_kwargs() -> dict:
    return {
        "key": settings.REFRESH_COOKIE_NAME,
        "max_age": settings.REFRESH_COOKIE_MAX_AGE,
        "secure": settings.REFRESH_COOKIE_SECURE,
        "httponly": True,
        "samesite": settings.REFRESH_COOKIE_SAMESITE,
        "path": settings.REFRESH_COOKIE_PATH,
    }


def set_refresh_cookie(response, token: str) -> None:
    response.set_cookie(value=token, **cookie_kwargs())


def clear_refresh_cookie(response) -> None:
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        path=settings.REFRESH_COOKIE_PATH,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
    )
