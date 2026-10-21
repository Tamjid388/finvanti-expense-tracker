# SPEC T4: Transaction Tests + schema.yml

> Parent: `docs/epics/transactions.md`. Depends on T2+T3. Status: implemented 2026-10-21.
> Implements PRD §14 for txns + §6.6 docs.

## Context

Proves 8 epic criteria and syncs OpenAPI before budgets/reports build on txns.

## Current State

`server/transactions/tests.py:1-3` empty; `schema.yml` no txn paths.

## Proposed Change

Add ~23 tests (`APITestCase` + JWT helper): unit 5 (amount/type/date/desc/Decimal-string), integration 11 (CRUD, filters combo, pagination, ordering, 400s, anon), security 6 (cross-user 404 ×3, чуж category 400, client-user ignored, tamper). Then `spectacular --file schema.yml`, diff review (5 routes + 4 filters), Swagger smoke. Update epic/spec status lines. `grep` docs links check.

## Acceptance Criteria

1. `test transactions` green 23/23; `check` clean; no threshold cuts.
   - protects=suite; fails_when=skip; no_claim=perf.
2. Security six pass with 404/400 discipline.
   - protects=isolation; fails_when=leak; no_claim=other resources.
3. Update/delete visibility: later `GET` list/summary reflects change (service-level, no cache).
   - protects=FR-TXN-09; fails_when=stale; no_claim=report math.
4. Schema shows five routes + filters; Swagger no warnings.
   - protects=FR-DOC; fails_when=missing; no_claim=client.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Unit | validators | +5 |
| Integration | CRUD/filters/page/order/400/anon | +11 |
| Security | isolation + tamper | +6 |
| Docs | check + spectacular | +1 |

## Rules

Real tests only; report validator changes separately; no secrets in logs; never commit `db.sqlite3`.

## Rollback

Revert tests/schema commit. No migration.

## Effort

~4h: 2.5h tests + 1h manual + 0.5h schema.

## Files Reference

| File | Change |
|------|--------|
| `server/transactions/tests.py` | New ~23 |
| `server/schema.yml` | Regenerated |
| `docs/epics/transactions.md` | Status Done |

## Out of Scope

Budget/report tests.

## Related

Prev T1–T3. Closes transactions DoD.
