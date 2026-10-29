# Deploy plan — client + server on Vercel

Two Vercel projects from this one repo. Backend deploys as a Python
serverless function, frontend as a static Vite SPA. Do backend first
(you need its URL for the frontend build), then wire CORS and redeploy.

## 0. Architecture

| Project  | Root Directory | What Vercel does |
|----------|---------------|------------------|
| Backend  | `server`      | Python 3.12 function (`api/index.py` → Django WSGI), `collectstatic` at build |
| Frontend | `client`      | `npm run build` → `dist/`, SPA fallback to `/index.html` |

Key files (already in repo, do not rename):

- `server/api/index.py` — serverless entrypoint, exposes `app`.
- `server/vercel.json` — runtime + build + rewrite all routes to `/api/index.py`.
- `client/vercel.json` — Vite build + SPA rewrite.
- `server/config/settings.py` — reads all prod config from env (see §2).

## 1. Prerequisites (one time)

- [ ] Repo pushed to GitHub.
- [ ] Vercel account connected to that GitHub repo.
- [ ] Neon (Postgres) database + pooled connection string ending `?sslmode=require`.
- [ ] New Django secret key (run locally, never commit it):
  ```powershell
  cd server; .\venv\Scripts\python.exe -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
  ```

## 2. Environment variables

### Backend (`server` project) — Production + Preview

| Name | Value | Notes |
|------|-------|-------|
| `DATABASE_URL` | `postgresql://…@ep-….neon.tech/…?sslmode=require` | Must exist at **build** time too (`collectstatic` imports settings). Add to all environments. |
| `SECRET_KEY` | output of §1 | Never commit, never reuse the `django-insecure-…` dev default. |
| `DEBUG` | `False` | Flips cookies to `SameSite=None; Secure`, tightens `ALLOWED_HOSTS`, enables secure cookies. |
| `FRONTEND_URL` | `https://<frontend>.vercel.app` | Comma-separated if more than one. Feeds CORS + CSRF. Localhost origins stay for dev. |
| `ALLOWED_HOSTS` | (optional) `.<your-domain>` | Only needed for a custom domain. Default already allows `127.0.0.1`, `localhost`, `.vercel.app`. |

Do NOT set `REFRESH_COOKIE_SAMESITE=Lax` on Vercel. Split Vercel
domains are cross-site (`app.vercel.app` → `api.vercel.app`), so prod
needs the default `None` + `Secure`, or silent refresh 401-loops.

### Frontend (`client` project) — Production

| Name | Value | Notes |
|------|-------|-------|
| `VITE_API_BASE_URL` | `https://<backend>.vercel.app` | No trailing slash. Baked in at **build** time — changing it requires redeploy. |

## 3. Deploy backend

1. Vercel → Add New → Project → import the repo.
2. Set **Root Directory** = `server` (Framework Preset: Other).
3. Add the backend env vars from §2. For the first deploy you don't know
   `FRONTEND_URL` yet — set it to `https://placeholder.invalid`, deploy,
   then fix it in §5.
4. Deploy. Note the URL: `https://<backend>.vercel.app`.
5. Run migrations against Neon **from local** (Vercel has no release step):
   ```powershell
   cd server
   $env:DATABASE_URL="<your-neon-url>"
   .\venv\Scripts\python.exe manage.py migrate
   ```
6. Smoke-test: open `https://<backend>.vercel.app/api/schema/` — expect
   the OpenAPI document, not a 500.

## 4. Deploy frontend

1. Vercel → Add New → Project → import the **same** repo.
2. Set **Root Directory** = `client` (Framework Preset: Vite).
3. Add `VITE_API_BASE_URL=https://<backend>.vercel.app`.
4. Deploy. Note the URL: `https://<frontend>.vercel.app`.

## 5. Close the loop (required once)

1. Backend project → Settings → Environment Variables → set
   `FRONTEND_URL=https://<frontend>.vercel.app` → **Redeploy** backend.
2. Frontend project → Redeploy (so the production build is cut against
   the final backend URL).
3. Log in on the frontend, refresh the page, hit an authenticated route.
   If login works but the next request 401s, the refresh cookie was
   dropped — recheck `DEBUG=False` and `FRONTEND_URL` on the backend.

## 6. Future redeploys

- Normal code change: `git push` → both projects auto-deploy (each watches
  its Root Directory). No manual steps.
- Backend URL changed: update `VITE_API_BASE_URL` on the frontend →
  redeploy frontend.
- Frontend URL changed: update `FRONTEND_URL` on the backend → redeploy backend.
- New model/migration: run the §3.5 `migrate` command locally against
  Neon **before or right after** pushing (tables must exist when the new
  code runs).
- New dependency: add to `server/requirements.txt` or
  `client/package.json` and push; Vercel installs on next build.

## 7. Troubleshooting

| Symptom | Cause → fix |
|---------|-------------|
| Build fails: `DATABASE_URL is not set` | `DATABASE_URL` missing from build-time env → add it to all environments, redeploy. |
| Build fails: `SECRET_KEY` / settings error | Env var typo → compare names against §2 exactly. |
| CORS error in browser console | Backend `FRONTEND_URL` doesn't match the frontend origin exactly (scheme + host, no path) → fix + redeploy backend. |
| Login succeeds, then 401 loop | Refresh cookie dropped cross-site → backend must have `DEBUG=False` (gives `SameSite=None; Secure`) and be on HTTPS. Both are true on Vercel by default — check for an override. |
| `DisallowedHost` 400 from API | Custom domain not in `ALLOWED_HOSTS` → set `ALLOWED_HOSTS` env, redeploy. |
| Static admin 404s | `collectstatic` didn't run → check build logs for the `server/vercel.json` `buildCommand`. |
| Frontend shows old API URL | `VITE_API_BASE_URL` is build-time → change the var, then **redeploy** (a restart isn't enough). |
| `python3.12` runtime error | Vercel changed supported runtimes → bump `functions."api/index.py".runtime` in `server/vercel.json` to a supported `python3.x` that still satisfies Django (≥3.12). |

## 8. What never to commit

`.env`, `venv/`, `db.sqlite3`, `staticfiles/`, `dist/`, `SECRET_KEY`,
tokens, passwords, `__pycache__`. All are gitignored — keep it that way.
Production secrets live only in Vercel env vars + your Neon dashboard.
