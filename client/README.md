# Expense Tracker — frontend (client/)

React SPA for the Personal Expense Tracker MVP.

- Architecture, tooling, folder structure: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- API contract + guardrails: [`AGENTS.md`](AGENTS.md)
- Backend contract sources: `../server/schema.yml`, `../prd.md` §7, `../docs/wireframes/web/` (UI reference)

## Commands

```powershell
npm install        # once
npm run dev        # Vite dev server → http://localhost:5173
npm run typecheck  # tsc -b (strict)
npm run build      # typecheck + production build → dist/
npm run preview    # serve the production build locally
```

## Status

Scaffolded and building:
**React 19 + Vite + TypeScript · TanStack Query v5 · React Router v8 · shadcn/ui (radix-nova preset) + Tailwind CSS v4.**

- Screens render as **placeholders** that mirror `../docs/wireframes/web/` — the Django REST API is not connected yet (backend lives in `../server/`, run it with `python manage.py runserver`).
- The typed endpoints (`src/api/`) and query/mutation hooks (`src/features/*/hooks/`) are already implemented — wire each page as its backend endpoints land.
- JWT tokens are stored **in memory only** (client/AGENTS.md contract) — reloading the app signs you out.

## Environment

Copy `.env.example` → `.env` (never commit `.env`) and set `VITE_API_BASE_URL` only if the API runs anywhere other than `http://127.0.0.1:8000`.
