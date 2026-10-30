# AGENTS.md — expense-tracker (root)

> Source of truth for AI agents working in this repo.
> Closest `AGENTS.md` to the edited file wins. Explicit user instructions override everything.
> Standard: https://agents.md — no required fields, plain Markdown, keep it short and true.

## Project overview

Personal Expense Tracker MVP — secure, API-first money tracker.
See `prd.md` (v1.0, 2026-10-20) for requirements, API surface (§7), data model (§8), and acceptance criteria (§13).

- `server/` — Django 6.1.2 + DRF + Simple JWT + drf-spectacular. SQLite locally, PostgreSQL in shared/deployed envs. See `server/AGENTS.md`.
- `client/` — React + Vite + TypeScript SPA scaffold (React 19, TanStack Query, React Router, shadcn/ui + Tailwind v4). Pages are placeholder UI until wired to the API. See `client/AGENTS.md` + `client/ARCHITECTURE.md`.
- `docs/wireframes/web/` + `docs/wireframes/mobile/` — static HTML/CSS/JS wireframes, the UI reference for `client/` screens.
- `server/schema.yml` — committed OpenAPI snapshot (currently auth-only, expand as endpoints land).

## Nested agent files

- `server/AGENTS.md` — backend setup, Django conventions, ownership/security rules.
- `client/AGENTS.md` — frontend API contract, JWT handling, UI conventions from wireframes + `prd.md` §10.
- Read the nested file for the directory you are editing. Do not duplicate its rules here.

## Skills

Use only repo-pinned `gstack` skills in this project. Do NOT use globally installed superpowers (e.g. `.superpowers/`, `~/.codex/skills/superpowers`).

Agent skills are pinned in `skills-lock.json` (currently `gstack` from `garrytan/gstack`).

- `.agents/skills/gstack/` — canonical skill library for this repo.
- `.claude/skills/gstack/` — Claude Code mirror of the same library.
- `agent/skills/gstack/` — generic-agent mirror of the same library.
- Invoke skills by name, e.g. `/office-hours`, `/plan-eng-review`, `/qa`, `/ship`, `/review`, `/investigate`. See `.agents/skills/gstack/AGENTS.md` for the full skill table and validation discipline.
- `SKILL.md` files are generated from `.tmpl` templates upstream — do not hand-edit generated skill output; edit the template if you must change a skill.

## Commands (root)

No root build. Run commands from the owning package:

```powershell
# backend (from server/)
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
python manage.py test
```

```powershell
# react frontend (from client/) — see client/ARCHITECTURE.md
npm install
npm run dev
npm run build
```

## Conventions (all packages)

- Money: `DecimalField`, serialize as decimal strings. Never float arithmetic.
- Auth: JWT Bearer on all financial endpoints. Owner derived from `request.user`, never from client payload.
- Reports: DB aggregation (`Sum`, `Group By`), inclusive calendar-date month boundaries, empty month = zeros not errors.
- Docs: keep `prd.md`, `server/schema.yml`, and drf-spectacular annotations in sync with routes.

## Guardrails

Always: scope every query/mutation to the authenticated user; check nearest `AGENTS.md` before editing.
Ask first: new dependency, DB engine change, auth/token policy change, category-deletion policy change.
Never: commit secrets, `.env`, `venv/`, `db.sqlite3`, tokens/passwords, or `__pycache__`. Never force-push `main`. Never log secrets.
