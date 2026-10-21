# AGENTS.md — client/

> Frontend scope only. This file wins over root `AGENTS.md` for files under `client/`.
> Status: `client/` is currently empty / uninitialized. This file defines the contract for scaffolding it.

## Project overview

Future frontend for Personal Expense Tracker MVP. API-first, consumes `server/` REST API.
Source of truth until scaffolded:

- `prd.md` §7 (routes), §10 (accessibility/UX), §12 (status codes/conventions)
- `server/schema.yml` (OpenAPI snapshot) + live Swagger at `server: /api/schema/swagger-ui/`
- `docs/wireframes/web/` + `docs/wireframes/mobile/` (static HTML/CSS/JS UI reference — screens, states, copy)

## Framework + stack (decided)

React + Vite + TypeScript · TanStack Query · React Router · shadcn/ui + Tailwind CSS.
Architecture, folder structure, and conventions: see [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Setup commands

Not scaffolded yet. Ask before new dependencies beyond the decided stack above.

```powershell
# once scaffolded, document here e.g.:
# npm install
# npm run dev
# npm test
```

When you scaffold: pick minimal Vite + TS (or PRD-aligned alternative), add `package.json` scripts, then update this section with exact install/dev/test/lint commands. Keep this file <150 lines.

## API contract (must follow)

- Base: `POST /api/auth/register/`, `POST /api/auth/login/`, `POST /api/auth/token/refresh/`, `GET /api/auth/me/`, CRUD `/api/categories/`, `/api/transactions/?type=&category_id=&start_date=&end_date=`, `/api/budgets/?month=YYYY-MM`, `GET /api/reports/monthly-summary/`, `category-breakdown/`, `budget-status/?month=YYYY-MM`.
- Auth: JWT Bearer. Access 15m, refresh 1d with rotation + blacklist. Store tokens in memory; clear on logout. 401 → try refresh once, then force login.
- Money: backend sends decimal strings (e.g. `"45.00"`). Never do float math — format/display as string, use integer minor units or decimal lib if summing. Currency: BDT only, no conversion (non-goal).
- Query: `month=YYYY-MM`, inclusive calendar-date boundaries. Empty month = zeros, not error — render empty/success states, not error toast.
- Errors: `201` create, `200` read/update, `204` delete, `400` field errors (show per-field), `401` re-auth, `404` not-found/concealed, `429` throttled. Confirm destructive deletes (txn/category).

## Code style / UX

- Mirror wireframes: Dashboard, Transactions (filter + pagination), Categories (type match, duplicate per user+type blocked), Budgets (`remaining = limit - spent`, over-budget allowed, delete never deletes txns), Reports, Profile.
- `prd.md` §10: keyboard-accessible, labeled inputs, loading/empty/success/error states, understandable validation messages, consistent BDT formatting.
- Category `type` must match txn `type`. Filter category dropdown by selected txn type (see wireframe `txnTypeSeg`).
- No bank-link, OCR, recurring, multi-wallet, i18n currency — out of scope.

## Testing instructions

No runner yet. After scaffold, add e.g. `npm test` + API-mock tests for: login/refresh/logout, txn CRUD + filters, budget remaining math display, empty-month zeros, 400/401 handling.
Verify against live `server/` (`python manage.py runserver`) before PR.

## Guardrails

Always: read root `AGENTS.md` + `server/AGENTS.md` for API/security rules; keep `server/schema.yml` in sync if contract drifts.
Ask first: framework choice, auth storage change, adding UI dependency.
Never: commit tokens, passwords, `.env`. Never hardcode API secrets or bypass 401 handling.
