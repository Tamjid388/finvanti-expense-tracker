# SPEC B4: Budget Tests + schema.yml

> Parent: `docs/epics/budgets.md`. Depends on B2+B3. Status: implemented 2026-10-21.
> Implements PRD §14 for budgets + §6.6.

## Context

Proves 8 epic criteria and publishes computed fields to OpenAPI.

## Current State

`server/budgets/tests.py:1-3` empty; schema has no budget paths.

## Proposed Change

~20 tests: unit 4 (month normalize, limit, null-unique, expense-only), integration 11 (CRUD, filters, dupe 400, math, over, delete-keeps, anon), security 3 (cross-user 404, чуж cat), concurrency 1 (dupe race), docs 1 (check+spectacular+Swagger). Update epic status.

## Acceptance Criteria

1. `test budgets` green; `check` clean.
   - protects=suite; fails_when=cut; no_claim=perf.
2. Math cases match Sum with Decimal strings.
   - protects=FR-BUD-06/07; fails_when=float; no_claim=reports.
3. Dupe race single 201.
   - protects=FR-BUD-04 concurrency; fails_when=two rows; no_claim=load.
4. Schema shows 5 routes + `spent/remaining/is_over`; Swagger clean.
   - protects=FR-DOC; fails_when=missing; no_claim=client.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Unit | +4 | |
| Integration | +11 | |
| Security | +3 | |
| Concurrency | +1 | |
| Docs | +1 | |

## Rules

Real tests; separate line for validator changes; no secrets.

## Rollback

Revert tests/schema commit.

## Effort

~4h.

## Files Reference

| File | Change |
|------|--------|
| `server/budgets/tests.py` | New ~20 |
| `server/schema.yml` | Regenerated |
| `docs/epics/budgets.md` | Status Done |

## Out of Scope

Txn/report suites.

## Related

Prev B1–B3. Closes budgets DoD.
