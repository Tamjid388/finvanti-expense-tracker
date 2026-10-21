"""Derived budget spend (docs/specs/budgets/03-spend-calc.md) — also called by
the reports budget-status view (docs/specs/reports/03-budget-status.md).

Money is a derived value: `spent = Sum(expense txns)` in the DB for the
calendar month, scoped by category when the budget has one. Income never
counts. No stored counter; over-budget never blocks anything.
"""

from datetime import date
from decimal import Decimal

from django.db.models import DateField, Sum
from django.db.models.functions import TruncMonth

from core.money import ZERO
from transactions.models import Transaction


def month_spend(user, month: date, category_id=None) -> Decimal:
    """Sum of expense transactions for `user` within the calendar month,
    optionally scoped to one category. Overall budget: category_id=None."""
    first = date(month.year, month.month, 1)
    from core.months import month_last_day

    last = month_last_day(first)
    queryset = Transaction.objects.filter(
        user=user, type="expense", date__range=(first, last)
    )
    if category_id is not None:
        queryset = queryset.filter(category_id=category_id)
    return queryset.aggregate(total=Sum("amount"))["total"] or ZERO


def spend_map_for_months(user, months, scope_keys=()) -> dict:
    """One grouped query for any number of months:
    `{(first_of_month, category_id_or_None): spent}`.

    The overall (None) scope is derived in the same pass by summing category
    scopes. Every requested month and scope key is pre-seeded (zeros when no
    transactions) so callers never need per-row lookup queries. Query count is
    constant regardless of budget count — the suites assert this.
    """
    keys = sorted({date(m.year, m.month, 1) for m in months})
    if not keys:
        return {}
    from core.months import month_last_day

    span_first, span_last = keys[0], max(month_last_day(m) for m in keys)
    rows = (
        Transaction.objects.filter(
            user=user, type="expense", date__range=(span_first, span_last)
        )
        .annotate(month_bucket=TruncMonth("date", output_field=DateField()))
        .values("month_bucket", "category_id")
        .annotate(total=Sum("amount"))
    )
    spend: dict = {}
    overall: dict[date, Decimal] = {}
    for row in rows:
        bucket: date = row["month_bucket"]
        month_key = date(bucket.year, bucket.month, 1)
        spend[(month_key, row["category_id"])] = row["total"] or ZERO
        overall[month_key] = overall.get(month_key, ZERO) + (row["total"] or ZERO)
    for month_key, total in overall.items():
        spend[(month_key, None)] = total
    for month_key in keys:
        spend.setdefault((month_key, None), ZERO)
    for scope_key in scope_keys:
        spend.setdefault(scope_key, ZERO)
    return spend


def status_fields(budget, spend_map: dict) -> dict:
    """Single source of the `{spent, remaining, is_over}` formula (B3/R3)."""
    spent = (spend_map or {}).get((budget.month, budget.category_id), ZERO)
    remaining = budget.limit_amount - spent
    return {"spent": spent, "remaining": remaining, "is_over": spent > budget.limit_amount}
