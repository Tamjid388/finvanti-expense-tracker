"""Shared test helpers (used only by app test suites)."""

from rest_framework import status
from rest_framework.test import APITestCase

TEST_PASSWORD = "StrongPass123"


def login(client, user, password: str = TEST_PASSWORD) -> str:
    """ obtain a JWT access token via the real email login endpoint."""
    response = client.post(
        "/api/auth/login/",
        {"email": user.email, "password": password},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK, response.data
    return response.data["access"]


class JWTAPITestCase(APITestCase):
    """APITestCase with token-based auth against the real login endpoint."""

    password = TEST_PASSWORD

    def auth(self, user) -> None:
        """Attach a fresh Bearer token for `user` to the test client."""
        token = login(self.client, user, password=self.password)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")


class JWTAuthMixin:
    """Mixin variant for tests needing both users authenticated alternately."""

    password = TEST_PASSWORD

    def auth(self, user) -> None:
        token = login(self.client, user, password=self.password)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
