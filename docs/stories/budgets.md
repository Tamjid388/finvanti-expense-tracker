# User Stories: Budgets

> Parent: `docs/epics/budgets.md`. Source: `prd.md` §6.4. UI: wireframes Budgets + budget status.

## Actors

Authenticated user capping monthly spend.

## Stories

### S1 — Set a cap
As a user, I want an overall (`category=null`) or per-expense-category monthly limit.
Maps to FR-BUD-01/02/03. Spec `02-crud-filter.md`.
Accept: `POST {month:"2026-10", limit_amount:"8000.00", category:null}` 201; income-category 400; чуж category 400.

### S2 — One cap per scope
As a user, I want duplicate month+scope rejected so totals stay unambiguous.
Maps to FR-BUD-04. Spec `01-model-constraints.md`.
Accept: second identical POST 400, including double overall.

### S3 — See spend vs left
As a user, I want `spent/remaining/is_over` derived from real expenses.
Maps to FR-BUD-06/07. Spec `03-spend-calc.md`.
Accept: `spent` equals Sum(month expenses, category-filtered); `remaining = limit - spent`; negative allowed.

### S4 — Over does not block
As a user, I want over-budget spending still recorded, status flips to over.
Maps to FR-BUD-08. Spec `03-spend-calc.md`.
Accept: txn 201 when over; budget `is_over=true`.

### S5 — Delete cap keeps history
As a user, I want budget delete to leave transactions alone.
Maps to FR-BUD-09. Spec `02-crud-filter.md`.
Accept: DELETE 204, txns still listed.

### S6 — Filter by month
As a user, I want `?month=&category_id=` to find caps.
Maps to FR-BUD-05. Spec `02-crud-filter.md`.
Accept: filters combine; bad month 400; чуж rows never appear.

### S7 — Full cap lifecycle (overall mirror)
As a user, I want to set caps, record spend against them, and clean up without losing history in one flow.
Mirrors S1–S6. Specs `01-model-constraints.md` + `02-crud-filter.md` + `03-spend-calc.md`.
Accept: create overall (`category=null`) + per-category cap 201; duplicate POST 400; add expense txns then `spent` equals Sum(month expenses, category-filtered), `remaining = limit - spent`; over-budget txn still 201 with `is_over=true`; `?month=&category_id=` finds caps; DELETE 204 leaves txns listed.

## Traceability

| Story | FR | Spec |
|-------|----|------|
| S1 | 01/02/03 | 02 |
| S2 | 04 | 01 |
| S3 | 06/07 | 03 |
| S4 | 08 | 03 |
| S5 | 09 | 02 |
| S6 | 05 | 02 |
| S7 | 01–09 | 01, 02, 03 |
