# PostgreSQL (NeonDB) Implementation Plan

> Status: implemented. PostgreSQL/NeonDB via `DATABASE_URL` is active in `server/config/settings.py`.

## Decision
- Full replace SQLite with PostgreSQL. No SQLite fallback.
- Production/local DB: NeonDB via single `DATABASE_URL` env var, currently empty; owner adds URL later.
- Config style: plain `os.environ` + stdlib `urllib.parse`. No `django-environ` / `dj-database-url`.
- Driver: `psycopg[binary]` (compatible with Django 6.1.2 + Python 3.13).

## Changes (when implemented)
1. `server/requirements.txt` — add `psycopg[binary]`.
2. `server/config/settings.py:87-92` — replace `django.db.backends.sqlite3` block with `django.db.backends.postgresql` parsed from `DATABASE_URL`:
   - `DATABASE_URL` empty/missing → raise `ImproperlyConfigured` with "set DATABASE_URL" message (fail fast, no silent SQLite).
   - When set: map to `NAME/USER/PASSWORD/HOST/PORT`; set `OPTIONS: {sslmode: require}` for Neon; `CONN_MAX_AGE=0` for MVP.
3. `server/AGENTS.md:40` — update "SQLite local" line to Postgres/Neon.
4. No model, route, or `schema.yml` changes. No data migration (local `db.sqlite3` is untracked/dev-only; fresh `migrate` on Neon).

## Local usage (after implementation)
```powershell
$env:DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require"
python manage.py check
python manage.py migrate
python manage.py test
```

## Guardrails
- Never commit `DATABASE_URL`, secrets, `db.sqlite3`, or `venv/`.
- Until URL is set, `check/migrate/test/runserver` will error by design.
