# Reference Index

> Diataxis map for `/document-release` coverage. Sources: `prd.md` §7 + §12, `server/schema.yml`, Swagger `/api/schema/swagger-ui/`.

## API references

- Auth: implemented in `server/users/`; contract in `server/schema.yml` + `prd.md:139-145`. No separate reference file — add one only if auth behavior changes.
- Categories: `docs/reference/categories-api.md` (5 routes, `?type=`).
- Transactions: `docs/reference/transactions-api.md` (5 routes, 4 filters, pagination).
- Budgets: `docs/reference/budgets-api.md` (5 routes + computed `spent/remaining/is_over`).
- Reports: `docs/reference/reports-api.md` (3 read-only routes).

## Doc sets

- Categories: epic `docs/epics/categories.md`, stories `docs/stories/categories.md`, specs `docs/specs/categories/`.
- Transactions: epic `docs/epics/transactions.md`, stories `docs/stories/transactions.md`, specs `docs/specs/transactions/`.
- Budgets: epic `docs/epics/budgets.md`, stories `docs/stories/budgets.md`, specs `docs/specs/budgets/`.
- Reports: epic `docs/epics/reports.md`, stories `docs/stories/reports.md`, specs `docs/specs/reports/`.

## Sync rule (root `AGENTS.md`)

After route changes: `python manage.py spectacular --file schema.yml`, review diff, smoke Swagger, keep `prd.md` + annotations aligned.
