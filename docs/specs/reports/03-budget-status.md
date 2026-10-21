# SPEC R3: Budget Status Join

> Parent: `docs/epics/reports.md`. Depends on Budgets B3. Status: spec only.
> Implements FR-REP-04 (+06/07 reuse).

## Context

Reuse budget spend logic per budget row for the requested month.

## Current State

No status path; B3 defines per-budget math.

## Proposed Change

`GET /api/reports/budget-status/?month=YYYY-MM` (required). List budgets for user+month (all scopes; no category filter here — document). For each, compute same `spent/remaining/is_over` as B3 (call shared helper, do not duplicate formula). Output rows with `budget_id, category_id|null, limit, spent, remaining, is_over`. Empty budgets list -> `[]` 200. Income excluded by helper.

## Acceptance Criteria

1. Each row matches Budgets-epic values for same month.
   - protects=FR-REP-04 consistency; fails_when=divergent formula; no_claim=write.
2. Overall (`null`) row spend equals all-expenses Sum; scoped row equals category Sum.
   - protects=scoping; fails_when=mix; no_claim=creation.
3. Bad month 400; чуж budgets excluded; anon 401.
   - protects=scope+auth; fails_when=leak; no_claim=other months.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Integration | overall+scoped+over+empty list | +4 |

In R4.

## Rules

Call B3 helper; no second formula copy; DB Sum; Decimal strings.

## Rollback

Remove view/route; budgets API unaffected.

## Effort

~3h.

## Files Reference

| File | Change |
|------|--------|
| `server/reports/views.py` | Add status view reusing budget helper |
| `server/reports/urls.py` | Add route |
| `server/core/` | Shared helper if not already in B3 |

## Out of Scope

Budget CRUD, summary/breakdown.

## Related

Prev `02`, next `04-tests-docs.md`. Depends on `docs/specs/budgets/03-spend-calc.md`.
