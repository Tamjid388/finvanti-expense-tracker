# SPEC R1: Monthly Summary Aggregation + Bounds

> Parent: `docs/epics/reports.md`. Depends on Transactions T3. Status: spec only.
> Implements FR-REP-01/02/05/06/08 for summary.

## Context

Single number per month users trust: income, expenses, net. Must handle empty months and boundary days.

## Current State

`server/reports/views.py:1-3`, `urls.py` empty; no summary path.

## Proposed Change

`GET /api/reports/monthly-summary/?month=YYYY-MM` (required). Parse `YYYY-MM` else 400. Bounds `[first, last-day]` inclusive `date__range`. Two `Sum` queries (or one conditional aggregation) filtered `user`. `None -> Decimal("0.00")`. Output strings. No cache.

```python
first = date(y, m, 1); last = date(y, m, monthrange(y, m)[1])
rows = Transaction.objects.filter(user=request.user, date__range=(first, last))
income = rows.filter(type="income").aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
expenses = rows.filter(type="expense").aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
net = income - expenses
```

## Acceptance Criteria

1. Populated month matches manual sums; strings with 2dp.
   - protects=FR-REP-01/02; fails_when=float; no_claim=all-time.
2. Empty month `0.00/0.00/0.00` 200, not 400/null.
   - protects=FR-REP-05; fails_when=error; no_claim=future special.
3. First/last-day txns counted; next-month excluded; bad month 400; чуж excluded.
   - protects=FR-REP-06/08; fails_when=off-by-one/leak; no_claim=tz.
4. Anon 401.
   - protects=privacy; fails_when=anon 200; no_claim=isolation depth.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Integration | sums, zeros, bounds, bad month, anon | +5 |

In R4.

## Rules

DB Sum; Decimal strings; user scope; shared month helper with budgets if present.

## Rollback

Remove view/route; 404 again.

## Effort

~3h.

## Files Reference

| File | Change |
|------|--------|
| `server/reports/views.py` | Add summary view + helper |
| `server/reports/urls.py` | Add route |

## Out of Scope

Breakdown/status, caching, export.

## Related

Epic R1, next `02-breakdown.md`.
