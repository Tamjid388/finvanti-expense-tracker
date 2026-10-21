"""Shared month-boundary helpers for budgets and reports.

Month policy (docs/specs/reports/01-monthly-summary.md, budgets 02-crud-filter.md):
`?month=YYYY-MM` required input form; stores/computes on first-of-month dates;
calendar bounds are inclusive `[first, last-day]` date-only ranges.
"""

import re
from calendar import monthrange
from datetime import date

from rest_framework.exceptions import ValidationError

_MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def parse_month_param(raw) -> date:
    """Parse `YYYY-MM` into the first-of-month date. Raise DRF 400 otherwise."""
    if raw is None or str(raw).strip() == "":
        raise ValidationError({"month": ["Month is required. Use YYYY-MM."]})
    value = str(raw).strip()
    if not _MONTH_RE.match(value):
        raise ValidationError({"month": ["Invalid month. Use YYYY-MM."]})
    return date(int(value[:4]), int(value[5:7]), 1)


def month_first(year: int, month: int) -> date:
    return date(year, month, 1)


def month_last_day(month: date) -> date:
    """Last calendar day of the month containing `month` (any day works)."""
    first = date(month.year, month.month, 1)
    return first.replace(day=monthrange(month.year, month.month)[1])


def month_bounds(year: int, month: int) -> tuple[date, date]:
    """Inclusive calendar bounds [first, last-day] for a year/month."""
    return month_first(year, month), month_last_day(month_first(year, month))


def format_month(month: date) -> str:
    """Render a first-of-month date as the `YYYY-MM` wire form."""
    return f"{month.year:04d}-{month.month:02d}"
