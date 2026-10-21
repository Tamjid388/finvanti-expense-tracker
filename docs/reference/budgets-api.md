# Reference: Budgets API

> Diataxis reference. Facts only. Source `prd.md` §7/§12.

## Auth

`Bearer <access>`. 401 on bad/missing token.

## Resource

`Budget { id, category: id|null (null=overall), month: YYYY-MM-01, limit_amount: string, spent: string read-only, remaining: string read-only, is_over: bool read-only }`. Input month form `YYYY-MM`.

## Endpoints

### `POST /api/budgets/` -> 201
Body `{"month":"2026-10","category":12,"limit_amount":"8000.00"}` or `"category":null`. 400 on bad month, limit≤0, income/чуж category, duplicate scope.
### `GET /api/budgets/?month=YYYY-MM&category_id=` -> 200
Both filters optional; bad month 400. Each row includes computed `spent/remaining/is_over`.
### `GET /api/budgets/{id}/` -> 200 | 404
Includes computed fields.
### `PATCH /api/budgets/{id}/` -> 200 | 400 | 404
Re-checks scope uniqueness + expense-only rule.
### `DELETE /api/budgets/{id}/` -> 204 | 404
Never deletes transactions.

Formulas: `spent = Sum(expense txns, user, month, category?)`, `remaining = limit - spent`, `is_over = spent > limit`.

## Related

Epic `docs/epics/budgets.md`, specs `docs/specs/budgets/`, stories `docs/stories/budgets.md`.
