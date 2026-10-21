# AGENTS.md — server/

> Backend scope only. This file wins over root `AGENTS.md` for files under `server/`.
> Stack: Python 3.13, Django 6.1.2, DRF 3.18.3, Simple JWT 5.5.1, drf-spectacular 0.30.0. See `requirements.txt`, `config/settings.py`, `prd.md`.

## Setup commands

Run from `server/`:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process  # only if activation is blocked
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser  # optional, for /admin/
python manage.py runserver        # http://127.0.0.1:8000/
```

Docs / schema:

```powershell
python manage.py spectacular --file schema.yml  # refresh committed schema.yml after route changes
# Swagger UI: /api/schema/swagger-ui/  |  Raw: /api/schema/
```

## Testing instructions

```powershell
python manage.py test                 # full Django suite
python manage.py test users           # one app: users | categories | transactions | budgets | reports
python manage.py check                # config sanity before PR
```

- PRD §14 is the test contract: validation, CRUD, filtering/pagination, anonymous-denied, cross-user blocked (list/detail/update/delete per resource), related-ID tampering, refresh rotation, empty-month and boundary months.
- `*_test` apps are placeholders except `users/` (register/login/refresh) — add model + API tests with every new endpoint. Do not lower thresholds to get green.

## Architecture

- `config/settings.py` — `IsAuthenticated` default, `JWTAuthentication` only, access 15m / refresh 1d, `ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION`. PostgreSQL/NeonDB only via `DATABASE_URL` (`server/.env` or env var); no SQLite fallback.
- `config/urls.py` — `api/auth/` → `users/urls.py`, `api/categories/`, `api/transactions/`, `api/budgets/`, `api/reports/`, `api/schema/`.
- Apps: `users/`, `categories/`, `transactions/`, `budgets/`, `reports/`, `core/` (empty, shared helpers go here). Each app: `models.py`, `serializers.py`, `views.py`, `urls.py`, `tests.py`.
- Current state: `users/serializers.py` + `users/views.py` exist (default `User` model); all other `models.py`/`views.py` are scaffolds. Implement per `prd.md` §8–§9.

## Conventions

- Owner scoping: filter every queryset by `request.user`; `perform_create` sets owner server-side. Inaccessible object → 404 (not 403) to avoid leaking existence. Never trust client `user`/`owner` fields.
- Money: `DecimalField(max_digits=…, decimal_places=2)`, amount > 0, serialize as string. Category `type` must equal transaction `type` (`income`|`expense`).
- Budgets: `month` as first-of-month date, `limit_amount` > 0; DB unique on `(user, month, category)` incl. null-category handling; `spent` derived from expense txns, `remaining = limit - spent`; over-budget never blocks txn creation; deleting a budget never deletes txns.
- Reports: aggregate in DB (`Sum`, no per-category N+1); `?month=YYYY-MM` inclusive calendar dates; empty month → `0` totals and `0` net.
- Serializers validate input; add DB constraints for invariants that must hold concurrently (uniqueness, checks). Multi-step writes in `transaction.atomic()`.
- Errors: `201` create, `200` read/update, `204` delete, `400` validation, `401` bad/missing token, `404` absent/concealed, `429` throttled; `5xx` never leaks tracebacks. Keep drf-spectacular annotations matching routes.

## Guardrails

Always: `select_related`/`prefetch_related` on FK-heavy list/report queries; paginate transaction lists.
Ask first: custom-vs-default user model change (decide before first prod migration), new dependency, changing token lifetimes, category-deletion policy (block/soft-delete/reassign per FR-CAT-06).
Never: commit `SECRET_KEY`, tokens, passwords, `venv/`, `db.sqlite3`, `__pycache__`. Never log credentials or raw financial payloads.
