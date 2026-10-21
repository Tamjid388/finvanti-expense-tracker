# SPEC B3: Spend / Remaining Calculation + Guards

> Parent: `docs/epics/budgets.md`. Depends on B2 + Transactions T3. Status: implemented 2026-10-21.
> Implements FR-BUD-06/07/08.

## Context

Status must derive from committed expenses every read; no counter, no blocking.

## Current State

B2 stores caps; `spent` undefined.

## Proposed Change

On serialize (or queryset annotation preferred):

```python
first = month.replace(day=1); last = monthrange(first.year, first.month)[1]
base = Transaction.objects.filter(user=request.user, type="expense", date__range=(first, last_day))
spent = base.filter(category=budget.category).aggregate(s=Sum("amount"))["s"] if budget.category_id else base.aggregate(s=Sum("amount"))["s"]
spent = spent or Decimal("0.00"); remaining = budget.limit_amount - spent; is_over = spent > budget.limit_amount
```

Prefer annotation in list to avoid per-row queries where practical; document query count in PR. Income never counted. Over-budget changes only `is_over/remaining`, never txn validation.

## Acceptance Criteria

1. Scoped spend equals manual Sum; overall equals all-expenses Sum; income excluded.
   - protects=FR-BUD-06; fails_when=counter; no_claim=report reuse.
2. `remaining = limit - spent` exact Decimal string; negative when over.
   - protects=FR-BUD-07; fails_when=float; no_claim=UI color.
3. Over-budget txn create still 201.
   - protects=FR-BUD-08; fails_when=blocked; no_claim=alert.
4. List of N budgets runs in constant queries (annotation or 1+1), asserted in B4.
   - protects=perf; fails_when=N+1; no_claim=load numbers.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Integration | scoped/overall/income-ignored/over/empty-month-zero | +5 |

In B4.

## Rules

DB `Sum` only; Decimal only; no stored `spent` column; no txn-side coupling.

## Rollback

Remove computed fields; rows return cap only.

## Effort

~3h.

## Files Reference

| File | Change |
|------|--------|
| `server/budgets/serializers.py` | Add read-only spent/remaining/is_over |
| `server/budgets/views.py` | Add annotation/helper |
| `server/core/` | Optional month-bounds helper shared with reports |

## Out of Scope

Report endpoints, notifications, rollover.

## Related

Prev `02`, next `04-tests-docs.md`.
