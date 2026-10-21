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
