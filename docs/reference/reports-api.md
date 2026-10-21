# Reference: Reports API

> Diataxis reference. Facts only. Read-only. Source `prd.md` §7/§12.

## Auth

`Bearer <access>` on all three. Anon 401.

## Endpoints

### `GET /api/reports/monthly-summary/?month=YYYY-MM` -> 200
`{"month":"2026-10","total_income":"45000.00","total_expenses":"12000.00","net_balance":"33000.00"}`. Empty month zeros. `month` required, invalid 400.

### `GET /api/reports/category-breakdown/?month=YYYY-MM&type=expense` -> 200
`[{"category_id":12,"category_name":"Food","total":"8000.00"}]` ordered total desc. `type` required `income|expense`.

### `GET /api/reports/budget-status/?month=YYYY-MM` -> 200
`[{"budget_id":3,"category_id":12,"limit":"8000.00","spent":"8500.00","remaining":"-500.00","is_over":true}]`. Overall rows have `category_id:null`.

Bounds: `[YYYY-MM-01, last-day]` inclusive date-only. DB `Sum`/`Group By`. No N+1.

## Related

Epic `docs/epics/reports.md`, specs `docs/specs/reports/`, stories `docs/stories/reports.md`.
