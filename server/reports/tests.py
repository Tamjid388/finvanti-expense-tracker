from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework import status

from categories.models import Category
from core.testing import JWTAPITestCase
from transactions.models import Transaction

SUMMARY_URL = "/api/reports/monthly-summary/"
BREAKDOWN_URL = "/api/reports/category-breakdown/"
STATUS_URL = "/api/reports/budget-status/"


def make_user(username: str) -> User:
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="StrongPass123",
    )


def make_category(user: User, type: str, name: str) -> Category:
    return Category.objects.create(owner=user, name=name, type=type)


def txn(user: User, category: Category, amount: str, when: date, type: str = None):
    return Transaction.objects.create(
        user=user,
        category=category,
        amount=Decimal(amount),
        type=type or category.type,
        date=when,
    )


class MonthlySummaryTests(JWTAPITestCase):
    """R1: DB sums, decimal strings, empty months, 400 discipline."""

    def setUp(self):
        self.user = make_user("alice_rep_sum")
        self.auth(self.user)

    def test_summary_matches_manual_sums_with_strings(self):
        salary = make_category(self.user, "income", "Salary")
        food = make_category(self.user, "expense", "Food")
        fuel = make_category(self.user, "expense", "Fuel")
        txn(self.user, salary, "2500.00", date(2026, 10, 1))
        txn(self.user, food, "30.50", date(2026, 10, 10))
        txn(self.user, fuel, "19.50", date(2026, 10, 20))
        res = self.client.get(SUMMARY_URL, {"month": "2026-10"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["month"], "2026-10")
        self.assertEqual(res.data["total_income"], "2500.00")
        self.assertEqual(res.data["total_expenses"], "50.00")
        self.assertEqual(res.data["net_balance"], "2450.00")
        for key in ("total_income", "total_expenses", "net_balance"):
            self.assertIsInstance(res.data[key], str)

    def test_empty_month_returns_zeros(self):
        res = self.client.get(SUMMARY_URL, {"month": "2026-01"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["month"], "2026-01")
        self.assertEqual(res.data["total_income"], "0.00")
        self.assertEqual(res.data["total_expenses"], "0.00")
        self.assertEqual(res.data["net_balance"], "0.00")

    def test_bad_or_missing_month_400(self):
        for params in ({}, {"month": ""}, {"month": "2026-13"},
                       {"month": "2026-02-01"}, {"month": "October"}):
            res = self.client.get(SUMMARY_URL, params)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, params)
            self.assertIn("month", res.data)


class CategoryBreakdownTests(JWTAPITestCase):
    """R2: one GROUP BY per (month, type), ordered by total desc."""

    def setUp(self):
        self.user = make_user("alice_rep_bd")
        self.auth(self.user)

    def test_breakdown_groups_orders_and_strings(self):
        food = make_category(self.user, "expense", "Food")
        fuel = make_category(self.user, "expense", "Fuel")
        rent = make_category(self.user, "expense", "Rent")
        txn(self.user, food, "10.00", date(2026, 10, 1))
        txn(self.user, food, "2.50", date(2026, 10, 2))
        txn(self.user, fuel, "80.00", date(2026, 10, 3))
        txn(self.user, rent, "80.00", date(2026, 10, 4))
        txn(self.user, food, "5.00", date(2026, 9, 30))  # other month
        res = self.client.get(
            BREAKDOWN_URL, {"month": "2026-10", "type": "expense"}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(
            res.data,
            [
                {"category_id": fuel.id, "category_name": "Fuel", "total": "80.00"},
                {"category_id": rent.id, "category_name": "Rent", "total": "80.00"},
                {"category_id": food.id, "category_name": "Food", "total": "12.50"},
            ],
        )

    def test_breakdown_type_income_groups_only_income(self):
        salary = make_category(self.user, "income", "Salary")
        freelance = make_category(self.user, "income", "Freelance")
        food = make_category(self.user, "expense", "Food")
        txn(self.user, salary, "1000.00", date(2026, 10, 5))
        txn(self.user, freelance, "500.00", date(2026, 10, 6))
        txn(self.user, food, "12.00", date(2026, 10, 7))
        res = self.client.get(BREAKDOWN_URL, {"month": "2026-10", "type": "income"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [(row["category_name"], row["total"]) for row in res.data],
            [("Salary", "1000.00"), ("Freelance", "500.00")],
        )

    def test_breakdown_empty_list_when_no_rows(self):
        res = self.client.get(BREAKDOWN_URL, {"month": "2026-03", "type": "expense"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, [])

    def test_breakdown_invalid_params_400(self):
        cases = [
            ({"type": "expense"}, "month"),          # month missing
            ({"month": "2026-10"}, "type"),          # type missing
            ({"month": "2026-10", "type": "all"}, "type"),
            ({"month": "2026-13", "type": "expense"}, "month"),
        ]
        for params, field in cases:
            res = self.client.get(BREAKDOWN_URL, params)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, params)
            self.assertIn(field, res.data)


class BudgetStatusTests(JWTAPITestCase):
    """R3: reuses the budgets formula; values match the Budgets API."""

    def setUp(self):
        self.user = make_user("alice_rep_status")
        self.groc = make_category(self.user, "expense", "Groc")
        self.fuel = make_category(self.user, "expense", "Fuel")
        self.auth(self.user)

    def _create_budgets(self):
        res1 = self.client.post(
            "/api/budgets/", {"month": "2026-10", "limit_amount": "500.00",
                              "category": None}, format="json")
        res2 = self.client.post(
            "/api/budgets/", {"month": "2026-10", "limit_amount": "100.00",
                              "category": self.groc.id}, format="json")
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED, res1.data)
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED, res2.data)
        return res1.data["id"], res2.data["id"]

    def test_status_matches_budgets_api_values(self):
        overall_id, groc_id = self._create_budgets()
        txn(self.user, self.groc, "30.00", date(2026, 10, 5))
        txn(self.user, self.fuel, "80.00", date(2026, 10, 6))
        res = self.client.get(STATUS_URL, {"month": "2026-10"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rows = {row["budget_id"]: row for row in res.data}
        budgets_res = self.client.get("/api/budgets/", {"month": "2026-10"})
        self.assertEqual(len(budgets_res.data), 2)
        for budget in budgets_res.data:
            row = rows[budget["id"]]
            self.assertEqual(row["category_id"], budget["category"])
            self.assertEqual(row["limit"], budget["limit_amount"])
            self.assertEqual(row["spent"], budget["spent"])
            self.assertEqual(row["remaining"], budget["remaining"])
            self.assertEqual(row["is_over"], budget["is_over"])
        # Scoping sanity on the shared formula: overall = groc + fuel;
        # scoped = category only. Income never counts.
        self.assertEqual(rows[overall_id]["spent"], "110.00")
        self.assertEqual(rows[groc_id]["spent"], "30.00")
        self.assertEqual(rows[groc_id]["remaining"], "70.00")
        self.assertFalse(rows[overall_id]["is_over"])

    def test_status_is_over_and_empty_month(self):
        overall_id, groc_id = self._create_budgets()
        txn(self.user, self.groc, "120.00", date(2026, 10, 5))
        res = self.client.get(STATUS_URL, {"month": "2026-10"})
        rows = {row["budget_id"]: row for row in res.data}
        self.assertTrue(rows[groc_id]["is_over"])
        self.assertEqual(rows[groc_id]["remaining"], "-20.00")
        res = self.client.get(STATUS_URL, {"month": "2026-12"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, [])

    def test_status_bad_or_missing_month_400(self):
        for params in ({}, {"month": "2026-13"}, {"month": "2026-10-01"}):
            res = self.client.get(STATUS_URL, params)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, params)
            self.assertIn("month", res.data)


class ReportSecurityTests(JWTAPITestCase):
    """Cross-user exclusion on all three endpoints + anon denial."""

    def setUp(self):
        self.alice = make_user("alice_rep_sec")
        self.bob = make_user("bob_rep_sec")
        self.alice_food = make_category(self.alice, "expense", "AliceFood")
        self.bobFood = make_category(self.bob, "expense", "BobFood")

    def test_summary_excludes_other_users_rows(self):
        txn(self.alice, self.alice_food, "900.00", date(2026, 10, 5))
        self.auth(self.bob)
        res = self.client.get(SUMMARY_URL, {"month": "2026-10"})
        self.assertEqual(res.data["total_expenses"], "0.00")
        self.assertEqual(res.data["net_balance"], "0.00")

    def test_breakdown_excludes_other_users_rows(self):
        txn(self.alice, self.alice_food, "900.00", date(2026, 10, 5))
        self.auth(self.bob)
        res = self.client.get(BREAKDOWN_URL, {"month": "2026-10", "type": "expense"})
        self.assertEqual(res.data, [])

    def test_budget_status_excludes_other_users_budgets(self):
        from budgets.models import Budget

        Budget.objects.create(
            user=self.alice, month=date(2026, 10, 1),
            limit_amount=Decimal("100.00"),
        )
        txn(self.alice, self.alice_food, "900.00", date(2026, 10, 5))
        self.auth(self.bob)
        res = self.client.get(STATUS_URL, {"month": "2026-10"})
        self.assertEqual(res.data, [])

    def test_anonymous_401_on_all_three(self):
        self.client.credentials()
        for url in (SUMMARY_URL, BREAKDOWN_URL, STATUS_URL):
            res = self.client.get(url, {"month": "2026-10", "type": "expense"})
            self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED, url)


class ReportBoundaryTests(JWTAPITestCase):
    """FR-REP-08: inclusive calendar-date bounds, no off-by-one."""

    def setUp(self):
        self.user = make_user("alice_rep_bounds")
        self.food = make_category(self.user, "expense", "Food")
        self.auth(self.user)

    def test_thirty_day_month_bounds_inclusive(self):
        txn(self.user, self.food, "3.00", date(2026, 3, 31))   # before April
        txn(self.user, self.food, "10.00", date(2026, 4, 1))   # first day
        txn(self.user, self.food, "20.00", date(2026, 4, 30))  # last day
        txn(self.user, self.food, "40.00", date(2026, 5, 1))   # after April
        res = self.client.get(SUMMARY_URL, {"month": "2026-04"})
        self.assertEqual(res.data["month"], "2026-04")
        self.assertEqual(res.data["total_expenses"], "30.00")
        self.assertEqual(res.data["net_balance"], "-30.00")

    def test_leap_february_includes_29th(self):
        txn(self.user, self.food, "15.00", date(2028, 2, 29))
        txn(self.user, self.food, "5.00", date(2028, 3, 1))
        res = self.client.get(SUMMARY_URL, {"month": "2028-02"})
        self.assertEqual(res.data["total_expenses"], "15.00")

    def test_non_leap_february_bounds(self):
        txn(self.user, self.food, "7.00", date(2027, 2, 28))
        txn(self.user, self.food, "5.00", date(2027, 3, 1))
        res = self.client.get(SUMMARY_URL, {"month": "2027-02"})
        self.assertEqual(res.data["total_expenses"], "7.00")

    def test_budget_spend_month_bounds(self):
        from budgets.models import Budget

        Budget.objects.create(
            user=self.user, month=date(2026, 2, 1),
            category=self.food, limit_amount=Decimal("10.00"),
        )
        txn(self.user, self.food, "3.00", date(2026, 2, 28))
        txn(self.user, self.food, "4.00", date(2026, 3, 1))
        res = self.client.get(STATUS_URL, {"month": "2026-02"})
        self.assertEqual(
            res.data, [
                {"budget_id": res.data[0]["budget_id"],
                 "category_id": self.food.id,
                 "limit": "10.00",
                 "spent": "3.00",
                 "remaining": "7.00",
                 "is_over": False,
                 },
            ]
        )


class BreakdownPerfTests(JWTAPITestCase):
    """FR-REP-07: grouping stays a single GROUP BY (1–2 queries)."""

    def test_breakdown_single_grouped_query(self):
        user = make_user("alice_rep_perf")
        categories = [
            make_category(user, "expense", f"Cat{i}") for i in range(3)
        ]
        for i in range(6):
            txn(
                user,
                categories[i % len(categories)],
                f"{(i + 1) * 10}.00",
                date(2026, 10, i + 1),
            )
        self.auth(user)
        with CaptureQueriesContext(connection) as ctx:
            res = self.client.get(
                BREAKDOWN_URL, {"month": "2026-10", "type": "expense"}
            )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 3)
        self.assertGreaterEqual(len(ctx), 1)
        self.assertLessEqual(len(ctx), 2)


class ReportDocsTests(JWTAPITestCase):
    """Docs (R4): OpenAPI documents the three report routes."""

    def test_schema_documents_report_routes(self):
        from drf_spectacular.generators import SchemaGenerator

        schema = SchemaGenerator().get_schema(public=True)
        for path in ("/api/reports/monthly-summary/",
                     "/api/reports/category-breakdown/",
                     "/api/reports/budget-status/"):
            self.assertIn(path, schema["paths"])
        breakdown_params = {
            p["name"] for p in schema["paths"][BREAKDOWN_URL]["get"]["parameters"]
        }
        self.assertLessEqual({"month", "type"}, breakdown_params)
