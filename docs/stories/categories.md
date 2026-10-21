# User Stories: Categories

> Parent epic: `docs/epics/categories.md`
> Source: `prd.md` §6.2 FR-CAT-01..07, §7 routes, §10 UX. UI reference: `docs/wireframes/web/index.html`, `docs/wireframes/mobile/index.html`.
> Decisions: D1 block-delete, D2 user-owned only, D3 CI-unique 1–100 chars, D4 PATCH-only.

## Actors

- Authenticated user organizing income/expenses. No guest, no admin, no sharing in MVP.

## Stories

### S1 — Create my own types
As an authenticated user, I want to create `income` / `expense` categories so I can file transactions.
Maps to FR-CAT-01/02, PRD §7 `POST /api/categories/`. Spec: `docs/specs/categories/02-crud-api.md`.
Accept: `POST {"name":"Food","type":"expense"}` returns 201; `type` outside set returns 400; owner equals `request.user`.

### S2 — See only my categories, filter by type
As a user, I want to list and retrieve only my categories, optionally `?type=`, so the picker stays small.
Maps to FR-CAT-01/03. Spec: `docs/specs/categories/02-crud-api.md`.
Accept: list ordered by `(name, id)`; invalid `type` returns 400; other users rows never appear; detail miss returns 404.

### S3 — Rename without creating dupes
As a user, I want to PATCH a name/type so `Food` vs ` food ` do not become two rows.
Maps to FR-CAT-01/04. Specs: `02-crud-api.md` + `03-delete-guard.md` for type-change rule.
Accept: trim, 1–100 chars, CI-unique per owner+type returns 400 on clash; same name allowed across types and across users.

### S4 — Cannot lose history on delete
As a user, I want delete blocked when transactions exist so reports stay correct.
Maps to FR-CAT-06. Spec: `docs/specs/categories/03-delete-guard.md`.
Accept: referenced `DELETE` returns 400 `category_in_use`, row survives; unreferenced returns 204.

### S5 — Type match stays safe
As a user, I want the API to refuse a category/type mismatch so breakdowns never mix income and expense.
Maps to FR-CAT-05. Contract defined here, enforced in Transactions epic.
Accept: `PATCH type` on referenced row returns 400; transaction epic reuses same lookup rule.

### S6 — No чуж defaults, no leaks
As a user, I want no system rows and no cross-user visibility in MVP.
Maps to FR-CAT-07 (deferred). Spec: `01-model-constraints.md` (`owner` required, no null).
Accept: second user sees empty list; `GET/PATCH/DELETE` чуж id returns 404, never 403.

### S7 — Full category lifecycle (overall mirror)
As a user, I want to create, organize, guard, and clean up categories in one flow without losing history or leaking data.
Mirrors S1–S6. Specs `01-model-constraints.md` + `02-crud-api.md` + `03-delete-guard.md`.
Accept: create `income` + `expense` 201 with owner=`request.user`; list `?type=` filtered and ordered by `(name, id)`; PATCH rename trims and 400 on CI-dupe per owner+type; DELETE referenced returns 400 `category_in_use` and row survives, unreferenced returns 204; PATCH `type` on referenced row returns 400; second user sees empty list and чуж ids return 404.

## Out of scope

Seeded defaults, soft-delete, reassignment, PUT, bulk create, substring search. See epic Out of Scope.

## Traceability

| Story | FR | Spec |
|-------|----|------|
| S1 | FR-CAT-01/02 | `02-crud-api.md` |
| S2 | FR-CAT-01/03 | `02-crud-api.md` |
| S3 | FR-CAT-01/04 | `02-crud-api.md`, `03-delete-guard.md` |
| S4 | FR-CAT-06 | `03-delete-guard.md` |
| S5 | FR-CAT-05 | `03-delete-guard.md` + Transactions epic |
| S6 | FR-CAT-07 | `01-model-constraints.md` |
| S7 | FR-CAT-01–07 | `01-model-constraints.md`, `02-crud-api.md`, `03-delete-guard.md` |
