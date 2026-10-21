from datetime import date
from decimal import Decimal
from unittest import mock

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from rest_framework import status

from categories.models import Category
from core.testing import JWTAPITestCase
from transactions.models import Transaction

LIST_URL = "/api/categories/"

TEST_PASSWORD = "StrongPass123"


def make_user(username: str) -> User:
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password=TEST_PASSWORD,
    )


def detail_url(pk: int) -> str:
    return f"{LIST_URL}{pk}/"


class CategoryModelUnitTests(JWTAPITestCase):
    """Unit: trim, length, type choices, CI-unique constraint (C4)."""

    def setUp(self):
        self.user = make_user("alice_cat")

    def test_name_is_stripped(self):
        self.auth(self.user)
        res = self.client.post(LIST_URL, {"name": "  Food  ", "type": "expense"})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["name"], "Food")

    def test_name_longer_than_100_rejected(self):
        self.auth(self.user)
        res = self.client.post(LIST_URL, {"name": "x" * 101, "type": "expense"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", res.data)

    def test_bad_type_rejected(self):
        self.auth(self.user)
        res = self.client.post(LIST_URL, {"name": "Wonky", "type": "other"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("type", res.data)

    def test_ci_unique_constraint_exists_and_enforces(self):
        names = {c.name for c in Category._meta.constraints}
        self.assertIn("uniq_category_owner_lower_name_type", names)
        Category.objects.create(owner=self.user, name="Food", type="expense")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Category.objects.create(owner=self.user, name="FOOD", type="expense")


class CategoryIntegrationTests(JWTAPITestCase):
    """Integration: five routes, filter/order, 400 shapes, guards, ownership."""

    def setUp(self):
        self.user = make_user("alice_cat2")
        self.other = make_user("bob_cat2")
        self.auth(self.user)

    def _income(self, name="Salary"):
        return Category.objects.create(owner=self.user, name=name, type="income")

    def _expense(self, name="Food"):
        return Category.objects.create(owner=self.user, name=name, type="expense")

    def test_create_returns_201_and_shape(self):
        res = self.client.post(LIST_URL, {"name": "Food", "type": "expense"})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            sorted(res.data.keys()),
            sorted(["id", "name", "type", "created_at", "updated_at"]),
        )
        self.assertNotIn("owner", res.data)

    def test_list_ordered_and_type_filter(self):
        self._expense("Banana")
        self._income("Salary")
        self._expense("Apple")
        res = self.client.get(LIST_URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual([c["name"] for c in res.data], ["Apple", "Banana", "Salary"])
        res = self.client.get(LIST_URL, {"type": "expense"})
        self.assertEqual([c["name"] for c in res.data], ["Apple", "Banana"])
        res = self.client.get(LIST_URL, {"type": "bogus"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("type", res.data)

    def test_retrieve_200(self):
        category = self._expense()
        res = self.client.get(detail_url(category.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["name"], "Food")

    def test_patch_rename_200(self):
        category = self._expense("Snacks")
        res = self.client.patch(detail_url(category.id), {"name": "Dining"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["name"], "Dining")

    def test_patch_duplicate_name_400(self):
        self._expense("Dining")
        target = self._expense("Snacks")
        res = self.client.patch(detail_url(target.id), {"name": " dining "})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", res.data)

    def test_delete_unreferenced_204_then_404(self):
        category = self._expense("Solo")
        res = self.client.delete(detail_url(category.id))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(res.content, b"")
        self.assertFalse(Category.objects.filter(pk=category.pk).exists())
        res = self.client.delete(detail_url(category.id))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_referenced_400_category_in_use(self):
        category = self._expense("Used")
        Transaction.objects.create(
            user=self.user,
            category=category,
            amount=Decimal("12.50"),
            type="expense",
            date=date(2026, 10, 5),
        )
        res = self.client.delete(detail_url(category.id))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["code"], "category_in_use")
        self.assertIn("fields", res.data)
        self.assertTrue(Category.objects.filter(pk=category.pk).exists())
        # Transactions were untouched.
        self.assertEqual(Transaction.objects.filter(category=category).count(), 1)

    def test_patch_type_change_guard(self):
        free_category = self._expense("Free")
        res = self.client.patch(detail_url(free_category.id), {"type": "income"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["type"], "income")

        used_category = self._expense("Used")
        Transaction.objects.create(
            user=self.user,
            category=used_category,
            amount=Decimal("5.00"),
            type="expense",
            date=date(2026, 10, 6),
        )
        res = self.client.patch(detail_url(used_category.id), {"type": "income"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("type", res.data)
        used_category.refresh_from_db()
        self.assertEqual(used_category.type, "expense")

    def test_client_owner_field_ignored(self):
        res = self.client.post(
            LIST_URL,
            {"name": "Hijack", "type": "expense", "owner": self.other.id},
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        category = Category.objects.get(name="Hijack")
        self.assertEqual(category.owner_id, self.user.id)

    def test_anonymous_401_on_all_five_routes(self):
        self.client.credentials()
        category = self._expense()
        body = {"name": "Food", "type": "expense"}
        cases = [
            (self.client.get(LIST_URL), None),
            (self.client.post(LIST_URL, body, format="json"), None),
            (self.client.get(detail_url(category.id)), None),
            (self.client.patch(detail_url(category.id), body, format="json"), None),
            (self.client.delete(detail_url(category.id)), None),
        ]
        for response, _ in cases:
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class CategorySecurityTests(JWTAPITestCase):
    """Security: cross-user list/detail/PATCH/DELETE concealment (C4)."""

    def setUp(self):
        self.alice = make_user("alice_sec_cat")
        self.category = Category.objects.create(
            owner=self.alice, name="Alice", type="expense"
        )
        self.bob = make_user("bob_sec_cat")
        self.auth(self.bob)

    def test_list_never_leaks_other_users_rows(self):
        res = self.client.get(LIST_URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, [])
        res = self.client.get(LIST_URL, {"type": "expense"})
        self.assertEqual(res.data, [])

    def test_cross_user_retrieve_404(self):
        res = self.client.get(detail_url(self.category.id))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_user_patch_404(self):
        res = self.client.patch(
            detail_url(self.category.id), {"name": "Nope"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_user_delete_404(self):
        res = self.client.delete(detail_url(self.category.id))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Category.objects.filter(pk=self.category.pk).exists())


class CategoryRaceTests(JWTAPITestCase):
    """Concurrency (C4): duplicate POST under race maps IntegrityError to 400."""

    def test_duplicate_post_race_maps_integrity_error_to_400(self):
        user = make_user("racer")
        Category.objects.create(owner=user, name="Food", type="expense")
        self.auth(user)
        # Bypass the serializer-level CI-duplicate check so only the DB
        # constraint stands between "FOOD" and the existing "Food" row.
        with mock.patch(
            "categories.serializers.CategorySerializer.validate",
            autospec=True,
            side_effect=lambda self, attrs: attrs,
        ):
            res = self.client.post(
                LIST_URL, {"name": "FOOD", "type": "expense"}, format="json"
            )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", res.data)


class CategoryDocsTests(JWTAPITestCase):
    """Docs (C4): OpenAPI documents the five category routes."""

    def test_schema_documents_category_routes(self):
        from drf_spectacular.generators import SchemaGenerator

        schema = SchemaGenerator().get_schema(public=True)
        self.assertIn("/api/categories/", schema["paths"])
        self.assertIn("/api/categories/{id}/", schema["paths"])
        path_item = schema["paths"]["/api/categories/{id}/"]
        for method in ("get", "patch", "delete"):
            self.assertIn(method, path_item)
        self.assertNotIn("put", path_item)
