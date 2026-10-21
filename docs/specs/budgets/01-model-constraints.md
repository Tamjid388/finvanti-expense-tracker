# SPEC B1: Budget Model + Null-Unique + Migration

> Parent: `docs/epics/budgets.md`. Depends on Categories C1 + Transactions T1. Status: spec only.
> Implements `prd.md:212-219`, FR-BUD-02/04.

## Context

One cap per user/month/scope needs a DB invariant that handles overall (`category=null`) correctly under race.

## Current State

Verified 2026-10-21: `server/budgets/models.py:1-3` empty; no migration.

## Proposed Change

Model per epic: `user` CASCADE, `category` nullable CASCADE, `month` first-of-month DateField, `limit_amount` Decimal 12,2, `UniqueConstraint(user,month,category,nulls_not_distinct=True)` + `limit>0` check + `(user,month)` index. Migration `0001` depends on categories/transactions initial + user.

Fallback: if SQLite `nulls_not_distinct` check fails on `migrate`, replace with two partial uniques (`condition=Q(category__isnull=True)` on `(user,month)` + `condition=Q(category__isnull=False)` on `(user,month,category)`). Document choice in PR; Postgres path stays primary per `docs/postgres-implementation.md`.

## Acceptance Criteria

1. Migrate creates table + unique + check + index.
   - protects=schema; fails_when=missing; no_claim=API.
2. Duplicate `(user,month,cat)` and duplicate `(user,month,null)` both rejected at DB.
   - protects=FR-BUD-04; fails_when=double row; no_claim=message (B2).
3. `limit≤0` rejected; `month` non-first-day normalized in serializer (B2), DB stores as given.
   - protects=FR-BUD-02; fails_when=saves; no_claim=normalize.
4. `check` passes.
   - protects=sanity; fails_when=errors; no_claim=runtime.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Unit | unique incl. null-scope, check | +2 |
| Integration | fresh migrate | +1 |

## Rules

`settings.AUTH_USER_MODEL`, string `"categories.Category"`. No counter column.

## Rollback

`migrate budgets zero`, delete migration if dependents absent.

## Effort

~3h: 1.5h model + 1h null-unique verify both DBs + 0.5h migrate.

## Files Reference

| File | Change |
|------|--------|
| `server/budgets/models.py` | Add model |
| `server/budgets/migrations/0001_initial.py` | New |

## Out of Scope

Serializers/views/calc/tests.

## Related

Epic B1, next `02-crud-filter.md`.
