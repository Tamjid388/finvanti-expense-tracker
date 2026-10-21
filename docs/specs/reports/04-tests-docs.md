# SPEC R4: Report Tests + Boundaries + Schema

> Parent: `docs/epics/reports.md`. Depends on R1–R3. Status: spec only.
> Implements PRD §14 for reports + §6.6.

## Context

Proves 8 epic criteria incl. boundaries and query counts, publishes three routes.

## Current State

`server/reports/tests.py` scaffold; schema has no report paths.

## Proposed Change

~18 tests: integration 9 (3 happy paths, zeros, invalid month ×3, anon ×3 collapsed), security 3 (cross-user exclusion per endpoint, anon), boundaries 4 (first-day, last-day, next-day-excluded, Feb/leap or 30-day month), perf 1 (breakdown query count), docs 1 (check+spectacular+Swagger). Update epic status.

## Acceptance Criteria

1. `test reports` green; `check` clean.
   - protects=suite; fails_when=cut; no_claim=load.
2. Boundary four pass with inclusive calendar dates.
   - protects=FR-REP-08; fails_when=off-by-one; no_claim=tz datetimes.
3. Breakdown stays 1–2 queries.
   - protects=FR-REP-07; fails_when=N+1; no_claim=scale numbers.
4. Schema shows 3 routes + params; Swagger clean.
   - protects=FR-DOC; fails_when=missing; no_claim=client.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Integration | +9 | |
| Security | +3 | |
| Boundaries | +4 | |
| Perf | +1 | |
| Docs | +1 | |

## Rules

Real rows, no mocks for sums; separate line for any validator change; no secrets.

## Rollback

Revert tests/schema commit. No migration.

## Effort

~4h.

## Files Reference

| File | Change |
|------|--------|
| `server/reports/tests.py` | New ~18 |
| `server/schema.yml` | Regenerated |
| `docs/epics/reports.md` | Status Done |

## Out of Scope

Txn/budget suites.

## Related

Prev R1–R3. Closes reports DoD.
