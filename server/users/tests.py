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
        self.assertNotIn("refresh", res.data)
        self.assertIn("refresh_token", res.cookies)

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

    def test_login_sets_http_only_cookie_and_access_only_body(self):
        res = self.client.post(
            "/api/auth/login/",
            {"email": "rafi@example.com", "password": "StrongPass123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access", res.data)
        self.assertNotIn("refresh", res.data)
        self.assertIn("refresh_token", res.cookies)
        self.assertTrue(res.cookies["refresh_token"]["httponly"])

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
        # Access token in body; refresh token lives in the cookie jar only.
        self.saved_refresh = self.client.cookies["refresh_token"].value
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
        res = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(res.cookies["refresh_token"].value, "")
        # Replay the blacklisted token via the deprecated body fallback.
        replay = self.client.post(
            "/api/auth/token/refresh/", {"refresh": self.saved_refresh}, format="json"
        )
        self.assertEqual(replay.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_missing_refresh_400(self):
        self.client.cookies.clear()
        res = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_logout_invalid_refresh_400(self):
        self.client.cookies.clear()
        res = self.client.post("/api/auth/logout/", {"refresh": "bogus"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_logout_anonymous_401(self):
        self.client.credentials()
        res = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_bad_cookie_401_then_login_shape(self):
        self.client.cookies.clear()
        self.client.cookies.load({"refresh_token": "bogus"})
        res = self.client.post("/api/auth/token/refresh/", {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_no_cookie_401(self):
        self.client.cookies.clear()
        res = self.client.post("/api/auth/token/refresh/", {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_after_access_expiry_succeeds(self):
        # Simulate an expired/missing access token: drop the header, refresh
        # via the cookie, then logout with the fresh access token.
        self.client.credentials()
        res = self.client.post("/api/auth/token/refresh/", {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access", res.data)
        self.assertNotIn("refresh", res.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        out = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(out.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(out.cookies["refresh_token"].value, "")


class GoogleAuthTests(APITestCase):
    def setUp(self):
        from django.contrib.auth.models import User
        self.password_user = User.objects.create_user(
            username="pwuser",
            email="pw@example.com",
            password="StrongPass123",
        )
        self.other = User.objects.create_user(
            username="otherg",
            email="other@example.com",
            password="StrongPass123",
        )

    def test_verify_rejects_forged_token(self):
        from users.google import verify_google_id_token
        with self.assertRaises(Exception):
            verify_google_id_token("forged.token.here")

    def test_google_sub_unique_across_users(self):
        from django.db import IntegrityError
        from users.models import GoogleAccount
        GoogleAccount.objects.create(user=self.password_user, sub="sub-123", email="a@x.com")
        with self.assertRaises(IntegrityError):
            GoogleAccount.objects.create(user=self.other, sub="sub-123", email="b@x.com")

    def test_google_login_creates_user_and_sets_cookie(self):
        from unittest.mock import patch
        with patch("users.views.verify_google_id_token", return_value={"sub": "sub-new", "email": "new@gmail.com", "email_verified": True}):
            res = self.client.post("/api/auth/google/", {"id_token": "t"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access", res.data)
        self.assertNotIn("refresh", res.data)
        self.assertIn("refresh_token", res.cookies)

    def test_google_login_existing_password_email_409(self):
        from unittest.mock import patch
        with patch("users.views.verify_google_id_token", return_value={"sub": "sub-x", "email": "PW@example.com", "email_verified": True}):
            res = self.client.post("/api/auth/google/", {"id_token": "t"}, format="json")
        self.assertEqual(res.status_code, 409)

    def test_google_link_then_login(self):
        from unittest.mock import patch
        # login as password user to get auth header
        login = self.client.post("/api/auth/login/", {"email": "pw@example.com", "password": "StrongPass123"}, format="json")
        self.assertEqual(login.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        with patch("users.views.verify_google_id_token", return_value={"sub": "sub-pw-1", "email": "pw@example.com", "email_verified": True}):
            link = self.client.post("/api/auth/google/link/", {"id_token": "t"}, format="json")
        self.assertEqual(link.status_code, 200)
        # logout-ish: clear creds, then google login should succeed
        self.client.credentials()
        self.client.cookies.clear()
        with patch("users.views.verify_google_id_token", return_value={"sub": "sub-pw-1", "email": "pw@example.com", "email_verified": True}):
            res = self.client.post("/api/auth/google/", {"id_token": "t"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)

    def test_google_link_sub_already_linked_to_other_409(self):
        from unittest.mock import patch
        from users.models import GoogleAccount
        GoogleAccount.objects.create(user=self.other, sub="sub-taken", email="other@example.com")
        login = self.client.post("/api/auth/login/", {"email": "pw@example.com", "password": "StrongPass123"}, format="json")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        with patch("users.views.verify_google_id_token", return_value={"sub": "sub-taken", "email": "pw@example.com", "email_verified": True}):
            link = self.client.post("/api/auth/google/link/", {"id_token": "t"}, format="json")
        self.assertEqual(link.status_code, 409)
