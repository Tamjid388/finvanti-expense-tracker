# Personal Expense Tracker

Secure, API-first money tracker — MVP per `prd.md` (v1.0, 2026-10-20).

Record income/expenses, organize by category, set monthly budgets, and view monthly summaries, category breakdowns, and budget status. All financial data is owner-scoped to the authenticated user.

## Features (MVP, `prd.md` §6)

- **Auth + profile:** register, login (JWT pair), refresh with rotation, logout with blacklist, `me` (`users/`)
- **Categories:** CRUD, `income`|`expense` types, filter by type, per-user uniqueness, type-match enforced on transactions
- **Transactions:** CRUD, positive `DecimalField` amounts (decimal strings in JSON), `type` + `date` + optional description, filter by `type` / `category_id` / `start_date` / `end_date`, pagination + deterministic ordering
- **Budgets:** monthly CRUD, `month` as first-of-month date, `limit_amount > 0`, DB unique on `(user, month, category)`, `spent` derived from expense txns, `remaining = limit - spent` (negative = over-budget, never blocks txn creation)
- **Reports:** `monthly-summary` (income / expenses / net), `category-breakdown` (DB `Sum`, no N+1), `budget-status` (limit / spent / remaining / over-budget). `?month=YYYY-MM`, inclusive calendar dates, empty month = zeros not errors
- **API docs:** drf-spectacular OpenAPI + Swagger UI, committed snapshot at `server/schema.yml`

Non-goals for MVP: bank linking, multi-currency (BDT only, display-only), multi-wallet/transfers, recurring/bills, OCR/receipts, sharing/billing.

## Repo layout

```
expense-tracker/
  prd.md                 # product spec, API surface §7, data model §8, acceptance §13
  server/                # Django 6.1.2 + DRF + Simple JWT + drf-spectacular (see server/AGENTS.md)
    config/              # settings.py, urls.py
    users/ categories/ transactions/ budgets/ reports/ core/
    schema.yml           # committed OpenAPI snapshot
    requirements.txt
  client/                # React 19 + Vite + TS + TanStack Query + React Router + shadcn/ui (see client/AGENTS.md, client/ARCHITECTURE.md)
    src/                 # api/ features/ components/ lib/ types/ router/
    .env.example         # VITE_API_BASE_URL
  docs/
    wireframes/web/ + mobile/  # static UI reference until client covers all screens
    specs/ stories/ epics/ reference/
  AGENTS.md server/AGENTS.md client/AGENTS.md  # agent working agreements
```

## Tech stack

| Layer | Pinned versions |
| --- | --- |
| Backend | Python 3.13, Django 6.1.2, DRF 3.18.3, Simple JWT 5.5.1, drf-spectacular 0.30.0, `psycopg[binary]` 3.2.9 — see `server/requirements.txt` |
| DB | PostgreSQL / NeonDB only via `DATABASE_URL`. No SQLite fallback (`server/config/settings.py` raises if unset) |
| Auth | JWT Bearer only, `IsAuthenticated` default. Access 15m / refresh 1d, `ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION` |
| Frontend | React 19, Vite 8, TypeScript strict, TanStack Query v5, React Router v8, shadcn/ui + Tailwind v4 — see `client/package.json` |

## Prerequisites

- Python 3.13 + PostgreSQL connection string (NeonDB works)
- Node 20+ / npm (for `client/`)

## Quickstart — backend (`server/`)

```powershell
cd server
python -m venv venv
.\venv\Scripts\Activate.ps1
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process  # only if activation is blocked
pip install -r requirements.txt

# env (never commit): $env:DATABASE_URL or server/.env
# server/.env:
#   DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require

python manage.py migrate
python manage.py createsuperuser  # optional, for /admin/
python manage.py runserver        # http://127.0.0.1:8000/
```

Docs / schema:

```powershell
python manage.py spectacular --file schema.yml  # refresh after route changes
```

- Swagger UI: `http://127.0.0.1:8000/api/schema/swagger-ui/`
- Raw schema: `http://127.0.0.1:8000/api/schema/`

Tests:

```powershell
python manage.py test                 # full suite
python manage.py test users           # one app: users | categories | transactions | budgets | reports
python manage.py check                # config sanity before PR
```

## Quickstart — frontend (`client/`)

```powershell
cd client
npm install
cp .env.example .env  # VITE_API_BASE_URL=http://127.0.0.1:8000 (no trailing slash)
npm run dev       # Vite dev server
npm run typecheck # tsc -b
npm run build     # tsc -b && vite build
```

Auth handling: tokens in memory only, `Authorization: Bearer <access>` on every call. On 401 → single refresh retry → force `/login`. Money arrives as decimal strings (e.g. `"45.00"`) — format as BDT, never float math. See `client/AGENTS.md`.

## API surface (`prd.md` §7, `server/config/urls.py`)

```
POST /api/auth/register/  POST /api/auth/login/
POST /api/auth/token/refresh/  POST /api/auth/logout/  GET /api/auth/me/

GET+POST /api/categories/  GET+PATCH+DELETE /api/categories/{id}/
GET+POST /api/transactions/  GET+PATCH+DELETE /api/transactions/{id}/
  ?type=&category_id=&start_date=&end_date= (+ pagination, ordering)
GET+POST /api/budgets/  GET+PATCH+DELETE /api/budgets/{id}/
  ?month=YYYY-MM&category_id=
GET /api/reports/monthly-summary/?month=YYYY-MM
GET /api/reports/category-breakdown/?month=YYYY-MM&type=expense
GET /api/reports/budget-status/?month=YYYY-MM
```

Conventions (`prd.md` §12): `201` create, `200` read/update, `204` delete, `400` validation (per-field), `401` missing/invalid token, `404` absent or concealed cross-user object (never `403` for existence leak), `429` throttled, `5xx` never leaks tracebacks.

## Core rules (for contributors)

- **Ownership:** every queryset filtered by `request.user`; owner set server-side in `perform_create`. Never trust client `user`/`owner`. Inaccessible object → `404`.
- **Money:** `DecimalField(..., decimal_places=2)`, amount > 0, JSON as string. Category `type` must equal transaction `type`.
- **Reports:** DB aggregation (`Sum`, `Group By`), `select_related`/`prefetch_related` on FK-heavy queries, paginate transaction lists.
- **Docs sync:** keep `prd.md`, `server/schema.yml`, and drf-spectacular annotations aligned with routes.
- **Never commit:** secrets, `.env`, `venv/`, `db.sqlite3`, tokens/passwords, `__pycache__`. Never force-push `main`. Never log credentials.

## Further reading

- `prd.md` — full requirements, acceptance criteria (§13), testing strategy (§14), delivery plan (§15)
- `server/AGENTS.md` — backend setup, architecture, test contract
- `client/AGENTS.md` + `client/ARCHITECTURE.md` — frontend API contract, folder/query-key conventions
- `server/schema.yml` + Swagger UI — live API contract
- `docs/wireframes/` — Dashboard / Transactions / Categories / Budgets / Reports / Profile reference
