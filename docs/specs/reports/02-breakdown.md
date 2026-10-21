# SPEC R2: Category Breakdown Grouping

> Parent: `docs/epics/reports.md`. Depends on T3. Status: implemented 2026-10-21.
> Implements FR-REP-03/07.

## Context

Per-category totals must come from one GROUP BY, not one query per category.

## Current State

No breakdown path.

## Proposed Change

`GET /api/reports/category-breakdown/?month=YYYY-MM&type=expense` (both required, 400 if missing/invalid). Query:

```python
Transaction.objects.filter(user=request.user, date__range=(first,last), type=qtype)
  .values("category_id", "category__name").annotate(total=Sum("amount")).order_by("-total", "category__name")
```

Output `[{category_id, category_name, total:string}]`. Empty list when none. Assert query count 1–2 in tests.

## Acceptance Criteria

1. Totals per category equal manual sums for month+type.
   - protects=FR-REP-03; fails_when=wrong grouping; no_claim=chart.
2. Single GROUP BY; query-count assert passes.
   - protects=FR-REP-07; fails_when=N+1; no_claim=load.
3. Missing/invalid month/type 400; чуж rows excluded.
   - protects=validation+scope; fails_when=silent; no_claim=other reports.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Integration | grouping, type filter, empty list, 400s | +4 |
| Perf | assertNumQueries 1–2 | +1 |

In R4.

## Rules

`values().annotate(Sum)`; Decimal strings; user+month+type scope always.

## Rollback

Remove view/route.

## Effort

~3h.

## Files Reference

| File | Change |
|------|--------|
| `server/reports/views.py` | Add breakdown view |
| `server/reports/urls.py` | Add route |

## Out of Scope

Summary/status.

## Related

Prev `01`, next `03-budget-status.md`.
