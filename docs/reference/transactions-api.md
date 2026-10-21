# Reference: Transactions API

> Diataxis reference. Facts only. Source `prd.md` §7/§12. Auth `server/AGENTS.md`.

## Auth

`Bearer <access>`. 401 on missing/invalid/expired.

## Resource

`Transaction { id, user(hidden), category: id, amount: string "12.50", type: income|expense, date: YYYY-MM-DD, description: 0–500, created_at, updated_at }`.

## Endpoints

### `POST /api/transactions/` -> 201
Body `{"category":12,"amount":"45.00","type":"expense","date":"2026-10-05","description":"Lunch"}`. 400 on amount≤0, bad type/date, чуж/mismatched category, >500 desc.

### `GET /api/transactions/?type=&category_id=&start_date=&end_date=` -> 200 paged
Filters combine. Invalid value/format or `start>end` 400. Order `-date,-id`. `select_related("category")`.

### `GET /api/transactions/{id}/` -> 200 | 404
### `PATCH /api/transactions/{id}/` -> 200 | 400 | 404
Partial. Re-checks category ownership + type-match. Changing category/type together validated jointly.
### `DELETE /api/transactions/{id}/` -> 204 | 404

Codes: 201/200/204/400/401/404/429. Amount always string. Date always `YYYY-MM-DD`.

## Related

Epic `docs/epics/transactions.md`, specs `docs/specs/transactions/`, stories `docs/stories/transactions.md`, `server/schema.yml`.
