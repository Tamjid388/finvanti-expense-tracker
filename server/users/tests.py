from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase


class EmailLoginTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="rafi",
            email="rafi@example.com",
            password="StrongPass123",
        )

    def test_login_with_email_success(self):
        res = self.client.post(
            "/api/auth/login/",
            {"email": "rafi@example.com", "password": "StrongPass123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)

    def test_login_email_case_insensitive(self):
        res = self.client.post(
            "/api/auth/login/",
            {"email": "RAFI@EXAMPLE.COM", "password": "StrongPass123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_login_wrong_password_401(self):
        res = self.client.post(
            "/api/auth/login/",
            {"email": "rafi@example.com", "password": "wrong"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_unknown_email_401(self):
        res = self.client.post(
            "/api/auth/login/",
            {"email": "nobody@example.com", "password": "StrongPass123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_username_payload_rejected(self):
        res = self.client.post(
            "/api/auth/login/",
            {"username": "rafi", "password": "StrongPass123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_duplicate_email_rejected(self):
        res = self.client.post(
            "/api/auth/register/",
            {"username": "rafi2", "email": "RAFI@example.com", "password": "StrongPass123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class MeLogoutTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="me_user",
            email="me@example.com",
            password="StrongPass123",
        )
        self.other = User.objects.create_user(
            username="other_user",
            email="other@example.com",
            password="StrongPass123",
        )
        res = self.client.post(
            "/api/auth/login/",
            {"email": "me@example.com", "password": "StrongPass123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.refresh = res.data["refresh"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")

    def test_me_returns_own_profile_only(self):
        res = self.client.get("/api/auth/me/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, {"id": self.user.id, "username": "me_user", "email": "me@example.com"})

    def test_me_anonymous_401(self):
        self.client.credentials()
        res = self.client.get("/api/auth/me/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_users_list_route_removed(self):
        res = self.client.get("/api/auth/users/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_logout_blacklists_refresh(self):
        res = self.client.post("/api/auth/logout/", {"refresh": self.refresh}, format="json")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        replay = self.client.post(
            "/api/auth/token/refresh/", {"refresh": self.refresh}, format="json"
        )
        self.assertEqual(replay.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_missing_refresh_400(self):
        res = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_logout_invalid_refresh_400(self):
        res = self.client.post("/api/auth/logout/", {"refresh": "bogus"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_logout_anonymous_401(self):
        self.client.credentials()
        res = self.client.post("/api/auth/logout/", {"refresh": self.refresh}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
