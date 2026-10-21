# User Stories: Transactions

> Parent: `docs/epics/transactions.md`. Source: `prd.md` §6.3, §10. UI: wireframes Transactions list + filters.

## Actors

Authenticated user recording income/expenses.

## Stories

### S1 — Record a transaction
As a user, I want to create an income/expense with amount, category, date so my history is complete.
Maps to FR-TXN-01/02/03. Spec `02-crud-filter-pagination.md`.
Accept: `POST` valid returns 201 with amount as `"45.00"`; zero/negative/bad type returns 400.

### S2 — Find it again
As a user, I want to list/retrieve with `type/category/start/end` + pages in newest-first order.
Maps to FR-TXN-07. Spec `02-crud-filter-pagination.md`.
Accept: filters combine; bad date or `start>end` 400; ordering `-date,-id` stable.

### S3 — Fix mistakes
As a user, I want to PATCH/delete so later totals update.
Maps to FR-TXN-01/09. Specs `02` + `03-ownership-typematch.md`.
Accept: PATCH valid 200, DELETE 204, later summary reflects change.

### S4 — Never mix types
As a user, I want category-type mismatch blocked so food-expense cannot file under salary-income.
Maps to FR-TXN-05. Spec `03-ownership-typematch.md`.
Accept: mismatched `category` returns 400 on `category`.

### S5 — My data only
As a user, I want чуж rows invisible and client `user` ignored.
Maps to FR-TXN-06 + isolation. Spec `03-ownership-typematch.md`.
Accept: чуж detail 404; list excludes чуж; sent `user` ignored.

### S6 — Clean input rules
As a user, I want clear errors for long descriptions and bad dates.
Maps to FR-TXN-08/10. Spec `02`.
Accept: empty description ok; >500 400; non-ISO date 400.

### S7 — Record to report-ready (overall mirror)
As a user, I want to record, find, fix, and guard transactions in one flow so later totals are correct.
Mirrors S1–S6. Specs `02-crud-filter-pagination.md` + `03-ownership-typematch.md`.
Accept: create income + expense 201 with amount as `"45.00"`; list with `type/category/start/end` + pagination in `-date,-id` order; PATCH 200 / DELETE 204 reflected in later summary; mismatched `category` returns 400; чуж detail returns 404, list excludes чуж, sent `user` ignored; empty description ok, >500 / non-ISO date / `start>end` returns 400.

## Traceability

| Story | FR | Spec |
|-------|----|------|
| S1 | 01/02/03/04 | 02 |
| S2 | 07/08 | 02 |
| S3 | 01/09 | 02, 03 |
| S4 | 05 | 03 |
| S5 | 06 + isolation | 03 |
| S6 | 08/10 | 02 |
| S7 | 01–10 + isolation | 02, 03 |
