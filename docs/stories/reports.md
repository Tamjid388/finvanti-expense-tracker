# User Stories: Reports

> Parent: `docs/epics/reports.md`. Source: `prd.md` §6.5, §10. UI: wireframes Dashboard + Reports.

## Actors

Authenticated user reviewing monthly position.

## Stories

### S1 — Month totals
As a user, I want income, expenses, net for `?month=` so I know the balance.
Maps to FR-REP-01/02. Spec `01-monthly-summary.md`.
Accept: `net = income - expenses`; decimals as strings.

### S2 — Where it went
As a user, I want per-category totals for month+type.
Maps to FR-REP-03. Spec `02-breakdown.md`.
Accept: sums match txns; ordered; no missing category.

### S3 — Budget health
As a user, I want each budget with limit/spent/remaining/over for the month.
Maps to FR-REP-04. Spec `03-budget-status.md`.
Accept: values match Budgets epic math.

### S4 — Empty is zeros
As a user, I want an empty month to show zeros, not errors.
Maps to FR-REP-05. Spec `01-monthly-summary.md`.
Accept: `{"total_income":"0.00","total_expenses":"0.00","net_balance":"0.00"}`.

### S5 — Mine only, month only
As a user, I want only my rows in the requested month.
Maps to FR-REP-06/08. Specs `01` + `04-tests-docs.md`.
Accept: чуж rows excluded; boundary days inclusive; next-month excluded; bad month 400.

### S6 — Month close review (overall mirror)
As a user, I want one month view showing totals, breakdown, and budget health so I know the balance.
Mirrors S1–S5. Specs `01-monthly-summary.md` + `02-breakdown.md` + `03-budget-status.md` + `04-tests-docs.md`.
Accept: same `?month=` returns summary (`net = income - expenses`, decimals as strings), breakdown sums matching txns ordered with no missing category, and budget-status matching Budgets epic math; empty month returns `{"total_income":"0.00","total_expenses":"0.00","net_balance":"0.00"}`; чуж rows excluded, boundary days inclusive, bad month 400.

## Traceability

| Story | FR | Spec |
|-------|----|------|
| S1 | 01/02 | 01 |
| S2 | 03/07 | 02 |
| S3 | 04 | 03 |
| S4 | 05 | 01 |
| S5 | 06/08 | 01, 04 |
| S6 | 01–08 | 01, 02, 03, 04 |
