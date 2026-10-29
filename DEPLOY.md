# Deploy plan — client + server on Vercel

Two Vercel projects from this one repo. Backend deploys as a Python
serverless function, frontend as a static Vite SPA. Do backend first
(you need its URL for the frontend build), then wire CORS and redeploy.

> Status (2026-10-29): both projects deployed and verified working via
> `vercel curl` (bypasses deployment protection):
> backend `https://finvanti-api.vercel.app`,
> frontend `https://finvanti-web-tamjid-ahmeds-projects-45d3f5d8.vercel.app`.
> Public access still needs §6 (disable Vercel Authentication).

## 0. Architecture

| Project  | Vercel name   | Root Directory | How it runs |
|----------|---------------|----------------|-------------|
| Backend  | `finvanti-api`| `server`       | Python function `api/index.py` → Django WSGI; all routes rewrite to it |
| Frontend | `finvanti-web`| `client`       | `npm run build` → `dist/`, SPA fallback to `/index.html` |

Key files (all in repo):

- `server/api/index.py` — serverless entrypoint, exposes `app`. (Vercel's
  zero-config Django detection via `manage.py` did **not** trigger on
  CLI-uploaded builds, so the explicit `api/` function + rewrite is required.)
- `server/vercel.json` — rewrites only. **Do not add `buildCommand`** — with a
  custom build command Vercel switches to a legacy path (CPython 3.14,
  `requirements.txt`-only, and `buildCommand` runs on a bare interpreter
  without the installed packages, so `collectstatic` fails there).
- `server/pyproject.toml` — `requires-python = ">=3.12"`, dependency pins
  (mirrors `requirements.txt`), explicit `tool.vercel.entrypoint`.
- `server/.python-version` — `3.12`. Honored on the no-`buildCommand` path
  (build log: "Using Python 3.12 from .python-version").
- `server/.vercelignore` — keeps `.env*`, `venv/`, `staticfiles/`, caches out
  of the uploaded bundle. Never ship secrets in the function bundle.
- `server/.gitignore` — created by `vercel link` (covers `.env.local`).
- `client/vercel.json` — Vite build + SPA rewrite.

Known limitation: `collectstatic` does **not** run on Vercel, so Django admin
/ DRF browsable-API pages are unstyled (their CSS 404s). The JSON API and the
SPA are unaffected — WhiteNoise just logs `No directory at: .../staticfiles/`
and keeps serving. If styled admin is ever needed, revisit then.

## 1. Prerequisites (one time)

- [ ] Repo pushed to GitHub.
- [ ] Vercel account + `npm i -g vercel`, logged in (`vercel whoami`).
- [ ] Neon (Postgres) pooled connection string ending `?sslmode=require`.
- [ ] New Django secret key (run locally, never commit it):
  ```powershell
  cd server; .\venv\Scripts\python.exe -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
  ```

## 2. Environment variables

### Backend (`finvanti-api`) — Production + Preview

| Name | Value | Notes |
|------|-------|-------|
| `DATABASE_URL` | `postgresql://…@ep-….neon.tech/…?sslmode=require` | Also needed at build time (settings import). Add to all environments. |
| `SECRET_KEY` | output of §1 | Never the `django-insecure-…` dev default. |
| `DEBUG` | `False` | Flips cookies to `SameSite=None; Secure`, tightens hosts, secure cookies. |
| `FRONTEND_URL` | `https://<frontend>.vercel.app` | Comma-separated if more than one. Feeds CORS + CSRF. Localhost origins stay for dev. |

`psycopg[binary]` must be `>= 3.2.10` (`==3.3.6` pinned): older pins have no
CPython 3.14 wheels and Vercel may resolve with 3.14. Keep the pin identical
in `requirements.txt` and `pyproject.toml`.

Do NOT set `REFRESH_COOKIE_SAMESITE=Lax` on Vercel. Split Vercel
domains are cross-site, so prod needs the default `None` + `Secure`, or
silent refresh 401-loops.

### Frontend (`finvanti-web`) — Production (+ Preview)

| Name | Value | Notes |
|------|-------|-------|
| `VITE_API_BASE_URL` | `https://finvanti-api.vercel.app` | No trailing slash. Baked in at **build** time — changing it requires redeploy. |

## 3. Deploy backend (CLI)

```powershell
cd server
vercel project add finvanti-api
vercel link --yes --project finvanti-api
# secrets via shell variables so they never print; repeat per environment:
vercel env add DATABASE_URL production --value "$db" --sensitive --yes
vercel env add SECRET_KEY production --value "$key" --sensitive --yes
vercel env add DEBUG production --value "False" --yes
vercel env add FRONTEND_URL production --value "https://placeholder.invalid" --yes
# (same four for preview), then:
vercel deploy --prod --yes
```

Run migrations against Neon **from local** (Vercel has no release step;
already applied 2026-10-29 — only needed for future model changes):
```powershell
cd server
.\venv\Scripts\python.exe manage.py migrate
```
First deploy used a `FRONTEND_URL` placeholder — fix it in §5, then redeploy.

Smoke-test (bypasses deployment protection while §6 is pending):
```powershell
vercel curl https://finvanti-api.vercel.app/api/schema/   # expect OpenAPI YAML
vercel curl https://finvanti-api.vercel.app/api/auth/me/  # expect DRF 401 JSON, not 500
```
`vercel curl` only supports GET-style `path` args — don't pass `-X`/`-H`;
it mangles them (plain-text `400 Bad Request` is the CLI, not the server).

## 4. Deploy frontend (CLI)

```powershell
cd client
vercel project add finvanti-web
vercel link --yes --project finvanti-web
vercel env add VITE_API_BASE_URL production --value "https://finvanti-api.vercel.app" --yes
vercel env add VITE_API_BASE_URL preview --value "https://finvanti-api.vercel.app" --yes
vercel deploy --prod --yes
```

Smoke-test: `vercel curl https://<frontend>/` serves `index.html`.

## 5. Close the loop (required once)

1. Backend project → update env (or dashboard) → **redeploy** backend:
   ```powershell
   cd server
   vercel env add FRONTEND_URL production --value "https://<frontend>" --force --yes
   vercel env add FRONTEND_URL preview --value "https://<frontend>" --force --yes
   vercel deploy --prod --yes
   ```
2. CORS proof: `GET /api/schema/` with an `Origin: <frontend>` header returns
   `Access-Control-Allow-Origin: <frontend>` + `Allow-Credentials: true`.
3. DB proof: `POST /api/auth/login/` with bogus credentials returns an
   app-level 4xx (serializer ran a DB query), never a 5xx.

## 6. Still in your dashboard (needs a browser session — not doable from CLI)

1. **Disable Vercel Authentication** (Deployment Protection) on BOTH projects,
   otherwise every visitor hits a Vercel login wall:
   Project → Settings → Deployment Protection → turn OFF Vercel Authentication
   (Production; Preview can stay protected).
2. **Connect Git** for auto-deploys on push (CLI-created projects start
   unconnected): Project → Settings → Git → connect
   `Tamjid388/finvanti-expense-tracker` and set Root Directory
   (`server` / `client`). Until then, redeploy from CLI after each push.

## 7. Future redeploys

- After §6.2: `git push` → both projects auto-deploy. Before that: redeploy
  from CLI (`vercel deploy --prod --yes` in `server/` / `client/`).
- Backend URL changed → update frontend `VITE_API_BASE_URL` → redeploy frontend.
- Frontend URL changed → update backend `FRONTEND_URL` → redeploy backend.
- New model/migration → run the §3 `migrate` locally against Neon before/after push.
- New dependency → pin identically in `server/requirements.txt` AND
  `server/pyproject.toml` (Vercel may install from either), or `client/package.json`; push.
- `psycopg[binary]` must keep CPython-3.14 wheels (currently `3.3.6`); don't
  downgrade below `3.2.10`.

## 8. Troubleshooting

| Symptom | Cause → fix |
|---------|-------------|
| Build: `psycopg-binary ... has no wheels with a matching Python ABI tag (cp314)` | Pin too old → bump `psycopg[binary]` (≥3.2.10) in both files. |
| Build uses CPython 3.14 / ignores `.python-version` | A `buildCommand` in `vercel.json` switches to the legacy path → remove `buildCommand`, redeploy. |
| `collectstatic` / `ModuleNotFoundError` in build | Same cause as above — the bare interpreter lacks the bundle packages. Don't run Django code in `buildCommand`. |
| Platform 404 (`NOT_FOUND`, `bom1::…`) on all API routes | No Python function detected — `api/index.py` missing or rewrites broken → restore both, redeploy. |
| Vercel login wall / `curl` 302 "Protected by Vercel Authentication" | §6.1 not done → disable Vercel Authentication for the project. |
| CORS error in browser console | Backend `FRONTEND_URL` doesn't exactly match the frontend origin (scheme + host, no path) → fix + redeploy backend. |
| Login succeeds, then 401 loop | Refresh cookie dropped cross-site → backend must have `DEBUG=False` (gives `SameSite=None; Secure`) over HTTPS. |
| `DisallowedHost` 400 | Custom domain not in `ALLOWED_HOSTS` → set `ALLOWED_HOSTS` env, redeploy. |
| Frontend shows old API URL | `VITE_API_BASE_URL` is build-time → change the var, then **redeploy** (restart isn't enough). |
| `manage.py test` locally: `test_neondb ... accessed by other users` | Stale pooled session from a killed run → `.\venv\Scripts\python.exe drop_test_db_once.py`, retry. |
| Frontend build fails: `DATABASE_URL is not set` (backend project) | `DATABASE_URL` missing from build-time env → add to all environments, redeploy. |

## 9. What never to commit

`.env`, `.env.local`, `venv/`, `db.sqlite3`, `staticfiles/`, `dist/`,
`SECRET_KEY`, tokens, passwords, `__pycache__`. All are gitignored — keep it
that way. Production secrets live only in Vercel env vars + the Neon dashboard.
