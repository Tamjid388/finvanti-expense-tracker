from datetime import date
from decimal import Decimal
from unittest import mock

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from rest_framework import status

from budgets.models import Budget
from categories.models import Category
from core.testing import JWTAPITestCase
from transactions.models import Transaction

LIST_URL = "/api/budgets/"


def make_user(username: str) -> User:
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="StrongPass123",
    )


def make_category(user: User, type: str, name: str) -> Category:
    return Category.objects.create(owner=user, name=name, type=type)


def expense_txn(user: User, category: Category, amount: str, when: date) -> Transaction:
    return Transaction.objects.create(
        user=user, category=category, amount=Decimal(amount),
        type="expense", date=when,
    )


class BudgetModelUnitTests(JWTAPITestCase):
    """Unit: month normalization, limit rule, null-aware unique backstop (B1)."""

    def setUp(self):
        self.user = make_user("alice_bud_uni")
        self.category = make_category(self.user, "expense", "Groc")

    def test_overall_budget_same_month_twice_rejected_by_constraint(self):
        Budget.objects.create(user=self.user, month=date(2026, 10, 1),
                              limit_amount=Decimal("100.00"))
        with self.assertRaises(IntegrityError), transaction.atomic():
            Budget.objects.create(user=self.user, month=date(2026, 10, 1),
                                  limit_amount=Decimal("5.00"))

    def test_category_scope_unique_but_other_months_ok(self):
        Budget.objects.create(user=self.user, month=date(2026, 10, 1),
                              category=self.category, limit_amount=Decimal("100.00"))
        Budget.objects.create(user=self.user, month=date(2026, 11, 1),
                              category=self.category, limit_amount=Decimal("100.00"))
        with self.assertRaises(IntegrityError), transaction.atomic():
            Budget.objects.create(user=self.user, month=date(2026, 10, 1),
                                  category=self.category, limit_amount=Decimal("9.00"))

    def test_limit_db_check_requires_positive(self):
        with self.assertRaises((IntegrityError, ValueError)), transaction.atomic():
            Budget.objects.create(user=self.user, month=date(2026, 10, 1),
                                  limit_amount=Decimal("0.00"))


class BudgetValidatorUnitTests(JWTAPITestCase):
    """Unit: wire-form validation (B2)."""

    def setUp(self):
        self.user = make_user("alice_bud_val")
        self.category = make_category(self.user, "expense", "Groc")
        self.auth(self.user)

    def _post(self, **overrides):
        payload = {"month": "2026-10", "limit_amount": "100.00",
                   "category": self.category.id}
        payload.update(overrides)
        return self.client.post(LIST_URL, payload, format="json")

    def test_month_accepts_yyyy_mm_and_normalizes(self):
        res = self._post()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["month"], "2026-10-01")
        row = Budget.objects.get(pk=res.data["id"])
        self.assertEqual(row.month, date(2026, 10, 1))

    def test_month_rejects_bad_wire_forms(self):
        for bad in ("2026-13", "2026-10-01", "October", "", "26-10"):
            res = self._post(month=bad)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, bad)
            self.assertIn("month", res.data)

    def test_limit_must_be_positive(self):
        for bad in ("0.00", "-1.50"):
            res = self._post(limit_amount=bad)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("limit_amount", res.data)

    def test_category_must_be_expense(self):
        income = make_category(self.user, "income", "Salary")
        res = self._post(category=income.id)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category", res.data)


class BudgetCrudTests(JWTAPITestCase):
    """Integration: five routes, filters, computed fields, delete-keeps-txns."""

    def setUp(self):
        self.user = make_user("alice_bud")
        self.groc = make_category(self.user, "expense", "Groc")
        self.fuel = make_category(self.user, "expense", "Fuel")
        self.auth(self.user)

    def _overall(self, month="2026-10", limit="500.00"):
        return self.client.post(
            LIST_URL, {"month": month, "limit_amount": limit, "category": None},
            format="json",
        )

    def _scoped(self, category_id, month="2026-10", limit="100.00"):
        return self.client.post(
            LIST_URL, {"month": month, "limit_amount": limit, "category": category_id},
            format="json",
        )

    def test_create_overall_budget_201_shape(self):
        res = self._overall()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(sorted(res.data.keys()),
                         sorted(["id", "category", "month", "limit_amount",
                                 "spent", "remaining", "is_over"]))
        self.assertIsNone(res.data["category"])
        self.assertEqual(res.data["limit_amount"], "500.00")
        self.assertEqual(res.data["spent"], "0.00")
        self.assertEqual(res.data["remaining"], "500.00")
        self.assertFalse(res.data["is_over"])
        self.assertNotIn("user", res.data)

    def test_retrieve_200(self):
        budget_id = self._scoped(self.groc.id).data["id"]
        res = self.client.get(f"{LIST_URL}{budget_id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["category"], self.groc.id)

    def test_patch_updates_limit_and_month(self):
        budget_id = self._scoped(self.groc.id).data["id"]
        res = self.client.patch(
            f"{LIST_URL}{budget_id}/", {"limit_amount": "42.00"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["limit_amount"], "42.00")
        row = Budget.objects.get(pk=budget_id)
        self.assertEqual(row.limit_amount, Decimal("42.00"))

    def test_patch_month_collision_400(self):
        b1_id = self._scoped(self.groc.id, month="2026-10").data["id"]
        self._scoped(self.groc.id, month="2026-11")
        res = self.client.patch(
            f"{LIST_URL}{b1_id}/", {"month": "2026-11"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", res.data)

    def test_delete_204_then_404(self):
        budget_id = self._overall().data["id"]
        res = self.client.delete(f"{LIST_URL}{budget_id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        res = self.client.delete(f"{LIST_URL}{budget_id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_keeps_transactions_and_category(self):
        budget_id = self._scoped(self.groc.id).data["id"]
        expense_txn(self.user, self.groc, "25.00", date(2026, 10, 5))
        res = self.client.delete(f"{LIST_URL}{budget_id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Budget.objects.filter(pk=budget_id).exists())
        self.assertEqual(Transaction.objects.count(), 1)
        self.assertTrue(Category.objects.filter(pk=self.groc.pk).exists())

    def test_list_order_and_filters(self):
        nov_overall_id = self._overall(month="2026-11").data["id"]
        oct_groc_id = self._scoped(self.groc.id, month="2026-10").data["id"]
        dec_fuel_id = self._scoped(self.fuel.id, month="2026-12").data["id"]
        res = self.client.get(LIST_URL)
        self.assertEqual(
            [b["id"] for b in res.data],
            [oct_groc_id, nov_overall_id, dec_fuel_id],
        )
        res = self.client.get(LIST_URL, {"month": "2026-11"})
        self.assertEqual(len(res.data), 1)
        res = self.client.get(LIST_URL, {"category_id": self.groc.id})
        self.assertEqual([b["category"] for b in res.data], [self.groc.id])
        res = self.client.get(
            LIST_URL, {"month": "2026-10", "category_id": self.groc.id}
        )
        self.assertEqual([b["category"] for b in res.data], [self.groc.id])

    def test_bad_filter_values_400(self):
        res = self.client.get(LIST_URL, {"month": "2026-13"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("month", res.data)
        res = self.client.get(LIST_URL, {"category_id": "abc"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", res.data)

    def test_duplicate_scope_400(self):
        res = self._scoped(self.groc.id)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        res = self._scoped(self.groc.id)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", res.data)


class BudgetSpendMathTests(JWTAPITestCase):
    """Integration: derived spent/remaining/is_over (B3)."""

    def setUp(self):
        self.user = make_user("alice_bud_math")
        self.groc = make_category(self.user, "expense", "Groc")
        self.fuel = make_category(self.user, "expense", "Fuel")
        self.auth(self.user)

    def _get_budget_by_category(self, category_id=None) -> dict:
        res = self.client.get(LIST_URL)
        for row in res.data:
            if row["category"] == category_id:
                return row
        raise AssertionError("budget missing")

    def test_spent_includes_month_expenses_only(self):
        self.client.post(
            LIST_URL, {"month": "2026-10", "limit_amount": "500.00",
                       "category": None}, format="json"
        )
        self.client.post(
            LIST_URL, {"month": "2026-10", "limit_amount": "100.00",
                       "category": self.groc.id}, format="json"
        )
        self.client.post(
            LIST_URL, {"month": "2026-11", "limit_amount": "50.00",
                       "category": self.fuel.id}, format="json"
        )
        expense_txn(self.user, self.groc, "30.00", date(2026, 10, 5))
        expense_txn(self.user, self.groc, "12.50", date(2026, 10, 20))
        expense_txn(self.user, self.fuel, "80.00", date(2026, 10, 7))
        expense_txn(self.user, self.groc, "9.99", date(2026, 9, 28))  # other month
        salary = make_category(self.user, "income", "Salary")
        Transaction.objects.create(
            user=self.user, category=salary, amount=Decimal("1000.00"),
            type="income", date=date(2026, 10, 9),
        )
        groc_budget = self._get_budget_by_category(self.groc.id)
        self.assertEqual(groc_budget["spent"], "42.50")
        self.assertEqual(groc_budget["remaining"], "57.50")
        self.assertFalse(groc_budget["is_over"])
        overall = self._get_budget_by_category(None)
        self.assertEqual(overall["spent"], "122.50")
        self.assertEqual(overall["remaining"], "377.50")
        fuel_budget = self._get_budget_by_category(self.fuel.id)
        self.assertEqual(fuel_budget["spent"], "0.00")

    def test_is_over_only_strictly_above_limit(self):
        self.client.post(
            LIST_URL, {"month": "2026-10", "limit_amount": "42.50",
                       "category": self.groc.id}, format="json"
        )
        expense_txn(self.user, self.groc, "42.50", date(2026, 10, 15))
        at_limit = self._get_budget_by_category(self.groc.id)
        self.assertFalse(at_limit["is_over"])
        self.assertEqual(at_limit["remaining"], "0.00")
        res = self.client.post(
            LIST_URL, {"month": "2026-11", "limit_amount": "10.00",
                       "category": self.groc.id}, format="json"
        )
        n_budget_id = res.data["id"]
        expense_txn(self.user, self.groc, "12.00", date(2026, 11, 1))
        res = self.client.get(f"{LIST_URL}{n_budget_id}/")
        self.assertTrue(res.data["is_over"])
        self.assertEqual(res.data["remaining"], "-2.00")

    def test_patch_limit_recomputes_status(self):
        created = self.client.post(
            LIST_URL, {"month": "2026-10", "limit_amount": "10.00",
                       "category": self.groc.id}, format="json"
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        budget_id = created.data["id"]
        expense_txn(self.user, self.groc, "12.00", date(2026, 10, 15))
        res = self.client.get(f"{LIST_URL}{budget_id}/")
        self.assertTrue(res.data["is_over"])
        self.client.patch(
            f"{LIST_URL}{budget_id}/", {"limit_amount": "50.00"}, format="json"
        )
        res = self.client.get(f"{LIST_URL}{budget_id}/")
        self.assertEqual(res.data["remaining"], "38.00")
        self.assertFalse(res.data["is_over"])


class BudgetSecurityTests(JWTAPITestCase):
    """Security: 404 concealment + foreign/absent category parity (B2)."""

    def setUp(self):
        self.alice = make_user("alice_bud_sec")
        self.bob = make_user("bob_bud_sec")
        self.alice_category = make_category(self.alice, "expense", "AliceGroc")
        self.budget = Budget.objects.create(
            user=self.alice, month=date(2026, 10, 1),
            category=self.alice_category, limit_amount=Decimal("100.00"),
        )
        self.auth(self.bob)

    def test_list_never_leaks_other_users_rows(self):
        res = self.client.get(LIST_URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, [])

    def test_cross_user_retrieve_patch_delete_404(self):
        url = f"{LIST_URL}{self.budget.id}/"
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        res = self.client.patch(url, {"limit_amount": "1.00"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        res = self.client.delete(url)
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Budget.objects.filter(pk=self.budget.pk).exists())

    def test_foreign_and_absent_category_same_400(self):
        body = lambda cid: {
            "month": "2026-10", "limit_amount": "10.00", "category": cid
        }
        foreign = self.client.post(LIST_URL, body(self.alice_category.id), format="json")
        absent = self.client.post(LIST_URL, body(999999), format="json")
        self.assertEqual(foreign.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(absent.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(foreign.data["category"], absent.data["category"])

    def test_client_user_field_ignored(self):
        own_category = make_category(self.bob, "expense", "BobGroc")
        res = self.client.post(
            LIST_URL,
            {"month": "2026-10", "limit_amount": "10.00", "category": own_category.id,
             "user": self.alice.id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        row = Budget.objects.get(pk=res.data["id"])
        self.assertEqual(row.user_id, self.bob.id)

    def test_anonymous_401_on_all_five_routes(self):
        body = {"month": "2026-10", "limit_amount": "1.00", "category": None}
        self.client.credentials()
        url = f"{LIST_URL}{self.budget.id}/"
        cases = [
            self.client.get(LIST_URL),
            self.client.post(LIST_URL, body, format="json"),
            self.client.get(url),
            self.client.patch(url, body, format="json"),
            self.client.delete(url),
        ]
        for response in cases:
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class BudgetRaceTests(JWTAPITestCase):
    """Concurrency (FR-BUD-04): duplicate scope under race → 400, one row."""

    def test_duplicate_race_maps_integrity_error_to_400(self):
        user = make_user("racer_bud")
        category = make_category(user, "expense", "Groc")
        Budget.objects.create(
            user=user, month=date(2026, 10, 1), category=category,
            limit_amount=Decimal("20.00"),
        )
        self.auth(user)
        # Bypass the serializer-level duplicate check; only the DB unique stands.
        with mock.patch(
            "budgets.serializers.BudgetSerializer.validate",
            autospec=True,
            side_effect=lambda self, attrs: attrs,
        ):
            res = self.client.post(
                LIST_URL,
                {"month": "2026-10", "limit_amount": "5.00", "category": category.id},
                format="json",
            )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", res.data)
        self.assertEqual(Budget.objects.count(), 1)


class BudgetDocsTests(JWTAPITestCase):
    """Docs (B4): OpenAPI documents five routes + computed fields."""

    def test_schema_documents_budget_routes_and_computed_fields(self):
        from drf_spectacular.generators import SchemaGenerator

        schema = SchemaGenerator().get_schema(public=True)
        self.assertIn("/api/budgets/", schema["paths"])
        path_item = schema["paths"]["/api/budgets/{id}/"]
        for method in ("get", "patch", "delete"):
            self.assertIn(method, path_item)
        self.assertNotIn("put", path_item)
        post_op = schema["paths"]["/api/budgets/"]["post"]
        ref = post_op["requestBody"]["content"]["application/json"]["schema"]["$ref"]
        name = ref.rsplit("/", 1)[-1]
        properties = schema["components"]["schemas"][name]["properties"]
        for key in ("month", "limit_amount", "category",
                    "spent", "remaining", "is_over"):
            self.assertIn(key, properties)
