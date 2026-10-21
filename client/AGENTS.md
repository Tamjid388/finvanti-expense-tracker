# AGENTS.md — client/

> Frontend scope only. This file wins over root `AGENTS.md` for files under `client/`.
> Status: **scaffolded** — React 19 + Vite + TypeScript, TanStack Query v5, React Router v8, shadcn/ui (radix-nova) + Tailwind CSS v4.
> `src/api/` endpoints + `src/features/*/hooks/` are implemented; pages render placeholder UI mirroring the wireframes until each backend endpoint lands (see `ARCHITECTURE.md`).

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

Baseline toolchain (see `ARCHITECTURE.md` for rationale): `npm i` resolved latest majors — react 19.3, react-router 8.5, @tanstack/react-query 5.104, tailwindcss 4.3, vite 8.3, typescript 7.0.

```powershell
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc -b (strict)
npm run build      # typecheck + production build
npm run preview    # serve dist/
```

Backend needed for real data live under `src/features/`/`src/api/`; pages are placeholders until wired. Verify against live `server/` (`python manage.py runserver`) before PRs. Here's the workflow: start Django first, then vite; login/refresh flows use the in-memory session in `src/features/auth/session.ts`.

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
Never: commit tokens, passwords, `.env`. Never hardcode API secrets or bypass 401 handling. Never hand-edit `src/api/schema.d.ts` (auto-generated, read-only) — change the backend, then `npm run gen:api`.
