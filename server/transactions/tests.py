from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from rest_framework import status

from categories.models import Category
from core.testing import JWTAPITestCase
from transactions.models import Transaction

LIST_URL = "/api/transactions/"


def make_user(username: str) -> User:
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="StrongPass123",
    )


def detail_url(pk: int) -> str:
    return f"{LIST_URL}{pk}/"


def make_category(user: User, type: str, name: str) -> Category:
    return Category.objects.create(owner=user, name=name, type=type)


def make_txn(user: User, category: Category, **overrides) -> Transaction:
    payload = dict(
        user=user,
        category=category,
        amount=Decimal("10.00"),
        type=category.type,
        date=date(2026, 10, 10),
    )
    payload.update(overrides)
    return Transaction.objects.create(**payload)


class TransactionValidatorUnitTests(JWTAPITestCase):
    """Unit: amount/type/date/description validators (T4 unit layer)."""

    def setUp(self):
        self.user = make_user("alice_txn_uni")
        self.category = make_category(self.user, "expense", "Food")
        self.auth(self.user)

    def _post(self, **overrides):
        payload = {
            "category": self.category.id,
            "amount": "10.00",
            "type": "expense",
            "date": "2026-10-10",
        }
        payload.update(overrides)
        return self.client.post(LIST_URL, payload, format="json")

    def test_amount_must_be_positive_two_dp(self):
        for bad in ("0.00", "-1.00", "9.999"):
            res = self._post(amount=bad)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("amount", res.data)

    def test_amount_serializes_as_decimal_string(self):
        res = self.client.post(
            LIST_URL,
            {
                "category": self.category.id,
                "amount": "45.00",
                "type": "expense",
                "date": "2026-10-10",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["amount"], "45.00")
        self.assertIsInstance(res.data["amount"], str)

    def test_bad_type_rejected(self):
        res = self._post(type="other")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("type", res.data)

    def test_invalid_date_rejected(self):
        res = self._post(date="2026-02-30")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("date", res.data)

    def test_description_length_bounds(self):
        res = self._post(description="x" * 500)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        res = self._post(description="x" * 501)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("description", res.data)


class TransactionCrudTests(JWTAPITestCase):
    """Integration: five routes, response shape, update visibility, ordering."""

    def setUp(self):
        self.user = make_user("alice_txn_crud")
        self.category = make_category(self.user, "expense", "Food")
        self.auth(self.user)

    def _txn(self, **overrides):
        return make_txn(self.user, self.category, **overrides)

    def test_create_returns_201_and_shape(self):
        res = self.client.post(
            LIST_URL,
            {
                "category": self.category.id,
                "amount": "12.50",
                "type": "expense",
                "date": "2026-10-05",
                "description": "Lunch",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["amount"], "12.50")
        self.assertEqual(res.data["category"], self.category.id)
        self.assertEqual(res.data["description"], "Lunch")
        self.assertNotIn("user", res.data)

    def test_description_optional_and_blank(self):
        res = self.client.post(
            LIST_URL,
            {
                "category": self.category.id,
                "amount": "1.00",
                "type": "expense",
                "date": "2026-10-05",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["description"], "")

    def test_retrieve_200(self):
        txn = self._txn()
        res = self.client.get(detail_url(txn.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["amount"], "10.00")

    def test_patch_reflects_in_later_gets(self):
        txn = self._txn()
        res = self.client.patch(detail_url(txn.id), {"amount": "80.00"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        res = self.client.get(detail_url(txn.id))
        self.assertEqual(res.data["amount"], "80.00")
        res = self.client.get(LIST_URL)
        amount = next(t["amount"] for t in res.data["results"] if t["id"] == txn.id)
        self.assertEqual(amount, "80.00")

    def test_delete_204_then_404(self):
        txn = self._txn()
        res = self.client.delete(detail_url(txn.id))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        res = self.client.delete(detail_url(txn.id))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_ordered_date_desc_then_id_desc(self):
        txn_old = self._txn(date=date(2026, 9, 30))
        a = self._txn(amount=Decimal("1.00"), date=date(2026, 10, 10))
        b = self._txn(amount=Decimal("2.00"), date=date(2026, 10, 10))
        res = self.client.get(LIST_URL)
        ids = [t["id"] for t in res.data["results"]]
        self.assertEqual(ids, [b.id, a.id, txn_old.id])


class TransactionFilterTests(JWTAPITestCase):
    """Integration: filters (solo + combined), bad-value 400s, pagination."""

    def setUp(self):
        self.user = make_user("alice_txn_fil")
        self.expense = make_category(self.user, "expense", "Food")
        self.expense2 = make_category(self.user, "expense", "Fuel")
        self.income = make_category(self.user, "income", "Salary")
        self.auth(self.user)

    def test_type_filter_and_bad_value_400(self):
        make_txn(self.user, self.expense)
        make_txn(self.user, self.income)
        res = self.client.get(LIST_URL, {"type": "expense"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(all(t["type"] == "expense" for t in res.data["results"]))
        res = self.client.get(LIST_URL, {"type": "bogus"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("type", res.data)

    def test_category_filter_and_bad_value_400(self):
        txn = make_txn(self.user, self.expense)
        make_txn(self.user, self.expense2)
        res = self.client.get(LIST_URL, {"category_id": self.expense.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual([t["id"] for t in res.data["results"]], [txn.id])
        res = self.client.get(LIST_URL, {"category_id": "abc"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", res.data)

    def test_date_range_filters_inclusive(self):
        d1 = make_txn(self.user, self.expense, date=date(2026, 10, 1))
        d2 = make_txn(self.user, self.expense2, date=date(2026, 10, 10))
        d3 = make_txn(self.user, self.expense, date=date(2026, 10, 31))
        make_txn(self.user, self.expense, date=date(2026, 11, 2))
        res = self.client.get(
            LIST_URL, {"start_date": "2026-10-01", "end_date": "2026-10-31"}
        )
        self.assertEqual([t["id"] for t in res.data["results"]], [d3.id, d2.id, d1.id])

    def test_bad_date_filters_and_crossed_range_400(self):
        for params in (
            {"start_date": "2026/10/01"},
            {"start_date": "2026-02-30"},
            {"end_date": "not-a-date"},
        ):
            res = self.client.get(LIST_URL, params)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        make_txn(self.user, self.expense, date=date(2026, 10, 10))
        res = self.client.get(
            LIST_URL, {"start_date": "2026-10-11", "end_date": "2026-10-01"}
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("start_date", res.data)

    def test_combined_filters_intersect(self):
        a = make_txn(self.user, self.expense, date=date(2026, 10, 10))
        make_txn(self.user, self.expense2, date=date(2026, 10, 11))
        make_txn(self.user, self.income, date=date(2026, 10, 10), amount=Decimal("1.00"))
        res = self.client.get(
            LIST_URL,
            {
                "type": "expense",
                "category_id": self.expense.id,
                "start_date": "2026-10-01",
                "end_date": "2026-10-20",
            },
        )
        self.assertEqual([t["id"] for t in res.data["results"]], [a.id])

    def test_pagination_page_size_20(self):
        category = self.expense
        for day in range(1, 22):
            make_txn(self.user, category, date=date(2026, 10, day))
        res = self.client.get(LIST_URL)
        self.assertEqual(res.data["count"], 21)
        self.assertEqual(len(res.data["results"]), 20)
        self.assertIn("page=2", res.data["next"])
        res = self.client.get(LIST_URL, {"page": 2})
        self.assertEqual(len(res.data["results"]), 1)
        self.assertIsNone(res.data["next"])

    def test_anonymous_401_on_all_five_routes(self):
        category = make_category(self.user, "expense", "Solo")
        txn = make_txn(self.user, category)
        body = {
            "category": category.id,
            "amount": "1.00",
            "type": "expense",
            "date": "2026-10-05",
        }
        self.client.credentials()
        cases = [
            self.client.get(LIST_URL),
            self.client.post(LIST_URL, body, format="json"),
            self.client.get(detail_url(txn.id)),
            self.client.patch(detail_url(txn.id), body, format="json"),
            self.client.delete(detail_url(txn.id)),
        ]
        for response in cases:
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TransactionSecurityTests(JWTAPITestCase):
    """Security: 404 concealment, no related-id leak, owner from token (T3)."""

    def setUp(self):
        self.alice = make_user("alice_txn_sec")
        self.bob = make_user("bob_txn_sec")
        self.alice_category = make_category(self.alice, "expense", "AliceFood")
        self.txn = make_txn(self.alice, self.alice_category)
        self.auth(self.bob)

    def test_list_never_leaks_other_users_rows(self):
        res = self.client.get(LIST_URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["results"], [])

    def test_cross_user_retrieve_404(self):
        res = self.client.get(detail_url(self.txn.id))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_user_patch_404(self):
        res = self.client.patch(
            detail_url(self.txn.id), {"amount": "9.99"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_user_delete_404(self):
        res = self.client.delete(detail_url(self.txn.id))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Transaction.objects.filter(pk=self.txn.pk).exists())

    def test_foreign_and_absent_category_same_400(self):
        foreign = self.client.post(
            LIST_URL,
            {
                "category": self.alice_category.id,
                "amount": "5.00",
                "type": "expense",
                "date": "2026-10-05",
            },
            format="json",
        )
        absent = self.client.post(
            LIST_URL,
            {
                "category": 999999,
                "amount": "5.00",
                "type": "expense",
                "date": "2026-10-05",
            },
            format="json",
        )
        self.assertEqual(foreign.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(absent.status_code, status.HTTP_400_BAD_REQUEST)
        # Identical body:no existence hint for foreign vs absent ids.
        self.assertEqual(foreign.data["category"], absent.data["category"])

    def test_client_user_field_ignored(self):
        own_category = make_category(self.bob, "expense", "BobFood")
        res = self.client.post(
            LIST_URL,
            {
                "category": own_category.id,
                "amount": "5.00",
                "type": "expense",
                "date": "2026-10-05",
                "user": self.alice.id,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        row = Transaction.objects.get(pk=res.data["id"])
        self.assertEqual(row.user_id, self.bob.id)


class TransactionTypeMatchTests(JWTAPITestCase):
    """Safety net: category/transaction type must agree (create and PATCH)."""

    def setUp(self):
        self.user = make_user("alice_txn_typematch")
        self.expense = make_category(self.user, "expense", "Food")
        self.income = make_category(self.user, "income", "Salary")
        self.auth(self.user)

    def test_create_type_mismatch_400(self):
        res = self.client.post(
            LIST_URL,
            {
                "category": self.expense.id,
                "amount": "5.00",
                "type": "income",
                "date": "2026-10-05",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category", res.data)

    def test_patch_category_to_mismatched_400(self):
        txn = make_txn(self.user, self.expense)
        res = self.client.patch(
            detail_url(txn.id), {"category": self.income.id}, format="json"
        )
        # Merges instance type (expense) with patched category (income).
        self.assertEqual(txn.type, "expense")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category", res.data)

    def test_patch_only_amount_still_ok(self):
        txn = make_txn(self.user, self.expense)
        res = self.client.patch(detail_url(txn.id), {"amount": "77.00"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["amount"], "77.00")


class TransactionDocsTests(JWTAPITestCase):
    """Docs (T4): OpenAPI documents five routes + filter params."""

    def test_schema_documents_transaction_routes_and_filters(self):
        from drf_spectacular.generators import SchemaGenerator

        schema = SchemaGenerator().get_schema(public=True)
        self.assertIn("/api/transactions/", schema["paths"])
        path_item = schema["paths"]["/api/transactions/{id}/"]
        for method in ("get", "patch", "delete"):
            self.assertIn(method, path_item)
        self.assertNotIn("put", path_item)
        list_params = {
            p["name"] for p in schema["paths"]["/api/transactions/"]["get"]["parameters"]
        }
        self.assertLessEqual({"type", "category_id", "start_date", "end_date"},
                             list_params)
