# SPEC T1: Transaction Model + Constraints + Migration

> Parent: `docs/epics/transactions.md`. Depends on Categories C1. Status: implemented 2026-10-21.
> Implements `prd.md:200-210`, FR-TXN-02/03/04. Rules: `server/AGENTS.md`.

## Context

Money rows need Decimal storage, positive check, and date/category indexes before any API. This closes the race and filter foundations.

## Current State

Verified 2026-10-21: `server/transactions/models.py:1-3` empty; no migration; `server/schema.yml` has no txn paths.

## Proposed Change

Add `Transaction` per epic Implementation Details: `user` FK CASCADE, `category` FK PROTECT, `amount` Decimal 12,2, `type` choices, `date` DateField, `description` 500 blank, timestamps, two checks, three indexes. Single `0001_initial.py` depending on categories `0001` + user migration.

## Acceptance Criteria

1. Migrate creates table + 2 checks + 3 indexes.
   - protects=schema; fails_when=missing; no_claim=API.
2. `amount` 0/negative rejected at DB; `type` outside set rejected.
   - protects=FR-TXN-03; fails_when=saves; no_claim=message text (T2).
3. `category` PROTECT blocks DB delete of referenced row.
   - protects=history backstop; fails_when=cascade; no_claim=view 400 text (Categories C3).
4. `check` passes.
   - protects=sanity; fails_when=errors; no_claim=runtime.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Unit | check/index names, PROTECT on delete attempt | +2 |
| Integration | fresh migrate green | +1 |

## Rules

Use `settings.AUTH_USER_MODEL`, string ref `"categories.Category"`. No float. No `schema.yml` change here.

## Rollback

`migrate transactions zero`, delete migration. If budgets/reports already query it, coordinated revert.

## Effort

~2h.

## Files Reference

| File | Change |
|------|--------|
| `server/transactions/models.py` | Add model |
| `server/transactions/migrations/0001_initial.py` | New |
| `server/transactions/admin.py` | Optional register |

## Out of Scope

Serializers/views/filters/guards/tests.

## Related

Epic T1, next `02-crud-filter-pagination.md`. `prd.md:200-210`.
