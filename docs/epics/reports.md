# Epic: Reports — Monthly Summary, Breakdown, Budget Status

> Status: spec only, no code changed.
> Source: `prd.md` §6.5, §7–§9, §13–§15. Rules: `server/AGENTS.md`.
> Depends on: transactions + budgets epics. No new tables.

## Context

Users need three read-only answers per month: totals + net, per-category totals, and budget status. All derive from committed transactions + budgets. No caching in MVP; every read aggregates in the DB.

## Current State

Verified 2026-10-21: `server/reports/models.py`, `views.py:1-3`, `urls.py`, `tests.py` scaffolds; `reports/` holds query/views only by design, no model table expected. No report paths in `schema.yml`.

Decisions locked: `?month=YYYY-MM` required; date-only inclusive `[first, last]` calendar bounds; empty month returns zeros; `Sum`/`Group By` in DB, never per-category N+1; `select_related` where FK read; user scope on every query.

## Proposed Change

Three GET endpoints, all `IsAuthenticated`, all user-scoped:

- `GET /api/reports/monthly-summary/?month=YYYY-MM` -> `{month, total_income, total_expenses, net_balance}` (decimal strings).
- `GET /api/reports/category-breakdown/?month=YYYY-MM&type=expense` -> `[{category_id, category_name, total}]` grouped, ordered by total desc.
- `GET /api/reports/budget-status/?month=YYYY-MM` -> `[{budget_id, category_id|null, limit, spent, remaining, is_over}]`.

`total_income = Sum(income)`, `total_expenses = Sum(expense)`, `net = income - expenses`. Category scope filters spend. Income ignored for budgets. Invalid month 400. Missing month 400. Future month allowed (zeros if no rows).

## Child Issues

| # | Title | Spec | Priority | Effort | Status | Dependencies |
|---|-------|------|--------|--------|--------|--------------|
| R1 | Monthly summary aggregation + bounds | `docs/specs/reports/01-monthly-summary.md` | Critical | 3h | Planned | T3 |
| R2 | Category breakdown grouping | `docs/specs/reports/02-breakdown.md` | Critical | 3h | Planned | T3 |
| R3 | Budget status join | `docs/specs/reports/03-budget-status.md` | High | 3h | Planned | B3 |
| R4 | Tests + boundaries + schema | `docs/specs/reports/04-tests-docs.md` | High | 4h | Planned | R1–R3 |

Total ~13h.

## Dependency Graph

```text
T3 ──> R1 summary ──┐
     └─> R2 breakdown ──> R4 tests
B3 ──> R3 budget-status ─┘
```

## Sequencing Rationale

R1 first proves month-bounds + zeros contract every report reuses. R2 next proves grouping without N+1. R3 last because it joins budgets to spend. R4 validates boundaries and schema once.

## Acceptance Criteria

1. Auth required on three routes; anon 401.
   - protects=privacy; fails_when=anon 200; no_claim=isolation depth.
2. Populated month matches manual sums; `net = income - expenses`; decimals as strings.
   - protects=FR-REP-01/02; fails_when=float or int math; no_claim=all-time cash.
3. Breakdown groups by category for month+type, totals equal txn sums, ordered, no N+1 (query-count assert).
   - protects=FR-REP-03/07; fails_when=per-category queries; no_claim=UI chart.
4. Budget status returns per-budget limit/spent/remaining/is_over consistent with Budgets epic.
   - protects=FR-REP-04; fails_when=stored counter; no_claim=write path.
5. Empty month returns zeros + `net "0.00"`, not 400/null.
   - protects=FR-REP-05; fails_when=error/null; no_claim=future months special-cased.
6. Cross-user data never included; `?month` invalid returns 400.
   - protects=FR-REP-06/08; fails_when=leak or 500; no_claim=tz timestamps (date-only).
7. Boundary txns on first/last day counted; next-month day-one excluded.
   - protects=FR-REP-08; fails_when=off-by-one; no_claim=time fields.
8. Schema documents three routes + params + shapes; Swagger clean.
   - protects=FR-DOC; fails_when=missing; no_claim=perf.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Integration | summary/breakdown/status happy paths, zeros, filters, invalid month | +9 |
| Security | cross-user exclusion, anon 401 | +3 |
| Boundaries | first/last/next-day, empty month | +4 |
| Perf | query-count assert on breakdown (1–2 queries) | +1 |
| Docs | check + spectacular | +1 |

## Rules for the implementing agent

1. Aggregate in DB (`Sum`, `values().annotate()`); no Python loops over categories.
2. Month bounds: `first = YYYY-MM-01`, `last = monthrange` last day, `date__range=[first,last]` inclusive.
3. Decimal strings out; never float.
4. Every query filters `user=request.user`. No new model table unless justified; reports live in views/services.

## Rollback Plan

Views-only; revert commit restores 404 on three paths. No migration.

## Effort Estimate

R1 3h + R2 3h + R3 3h + R4 4h = ~13h.

## Files Reference

| File | Change |
|------|--------|
| `server/reports/views.py` | Three views + query helpers, annotations |
| `server/reports/urls.py` | Three GET routes |
| `server/reports/tests.py` | New ~18 tests |
| `server/core/` | Optional shared month-bounds helper if reused by budgets |
| `server/schema.yml` | Regenerate in R4 |

## Out of Scope

Caching, CSV export, charts, all-time balances, custom ranges beyond month (use txn filters).

## Related

- `prd.md` §6.5 + §7 reports + §9, `server/AGENTS.md:50`.
- Stories `docs/stories/reports.md`, specs `docs/specs/reports/`, reference `docs/reference/reports-api.md`.
- Parents `docs/epics/transactions.md`, `docs/epics/budgets.md`.

## Definition of Done

1. `check` + `test reports` green with query-count asserts.
2. Eight criteria verified via `runserver`, incl. boundary dates.
3. Schema + Swagger show three routes.
4. No cross-user rows in manual check.
