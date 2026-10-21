# HANDOFF.md — backend features QA run in progress (v2, includes server-exit addendum)

> Recreated 2026-10-21 after the original v1 file disappeared from the repo root (likely moved into the handoff chat). Content = v1 + a small addendum.
> Purpose: continue where this session stopped — the `/qa` live-API run is mid-flight.
> Read fully before touching anything. The backend code is DONE and green; only verification + docs remain.

---

## 1. Objective and where things stand

Original objective: implement + verify backend features (categories, transactions, budgets, reports) for the Django/DRF expense tracker per `docs/specs/*`, `docs/epics/*`, `prd.md`; use `/qa` and `/review` skills; sync `schema.yml` and docs.

**State: implementation + tests COMPLETE and green. Schema regenerated. `/qa` live-run ~30% done (stopped after probe 020). `/review` not started. Docs status lines not updated.**

### Completed and verified (do not redo)

| Area | Status |
|---|---|
| `core/` helpers (`months.py`, `money.py`, `testing.py`, `serializers.py`) | Done |
| Categories: model+migration, serializer, viewset (`/api/categories/`), tests | Done — 20 tests |
| Transactions: model+migration, serializer, viewset (`/api/transactions/`), tests | Done — 28 tests |
| Budgets: model+migration, serializer, `services.py`, viewset (`/api/budgets/`), tests | Done — 26 tests |
| Reports: 3 APIViews (`monthly-summary/`, `category-breakdown/`, `budget-status/`), tests | Done — 20 tests |
| Users app (pre-existing) | untouched, 6 tests |
| `manage.py check` | clean |
| `manage.py test --keepdb` full suite | **100 tests OK** (ran twice after last changes) |
| `manage.py spectacular --file schema.yml` | regenerated, **zero warnings**; 14 `api/` paths; money fields typed as strings (`limit_amount` has decimal pattern); `is_over` boolean; `id` path params int |
| All three feature migrations | applied to Neon dev DB |

Key runtime facts: pagination on transactions only (page size 20 → `{"count","next","previous","results"}`); money everywhere as 2dp decimal strings; categories/budgets/reports lists are plain arrays (no global pagination); login is by email (`{"email","password"}` → `{"access","refresh"}`).

### Not a git repo

No commits possible — the files on disk are the deliverable. QA phase 8d "commit each fix" is N/A; keep fixes as file writes and note them in the QA report.

---

## 2. Files that changed in this session (all under `server/`)

- `server/categories/{models,serializers,views,urls,tests,admin}.py`
- `server/transactions/{models,serializers,views,urls,tests,admin}.py` + `0001` migration
- `server/budgets/{models,serializers,services,views,urls,tests,admin}.py` + `0001` migration
- `server/reports/{views,urls,tests}.py`
- `server/core/{months,money,testing,serializers}.py` — `core/serializers.py` NEW: `OwnedCategoryField` (read before editing transactions/budgets serializers; both use it — foreign and absent category ids must return the SAME `"Invalid category."` error, no existence leak)
- `server/schema.yml` — regenerated
- `server/categories/tests.py`, `server/transactions/tests.py`, `server/budgets/tests.py`, `server/reports/tests.py` — NEW
- `server/.gstack/qa-reports/run-20261021-functional/functional/` — QA evidence so far

Notable fixes made during this session (already in the files above):
1. `transactions/serializers.py` — absent category id leaked `Invalid pk "..." object does not exist` vs foreign id's `"Invalid category."`. Fixed by user-scoped `OwnedCategoryField` in `core/serializers.py`; `validate()` now only does joint type-match on input-or-instance.
2. `budgets/serializers.py` — same leak fixed via shared `OwnedCategoryField`; `validate_category` removed.
3. **Money bug**: `BudgetSerializer` `spent`/`remaining` returned raw `Decimal` → DRF JSON encoder renders that as **float** on the wire (violates the never-float rule). Fixed: getters now `as_money(...) -> str`, `is_over -> bool` (type hints also fixed the drf-spectacular warnings).
4. Reports views + all three viewsets: explicit OpenAPI response/path annotations (report endpoints were being silently **ignored** by the schema generator before).

---

## 3. `/qa` live run — current state

- Skill: loaded `qa` → **degraded mode** (no `~/.claude/skills/gstack/bin/*` on this machine, no repo bin → no gstack-skill-start, no EVIDENCE_TOOL/DEADLINE_TOOL, no telemetry). Manual evidence capture per probe is the agreed substitute.
- Report dir: `server/.gstack/qa-reports/run-20261021-functional/` (probe subdir `functional/`).
- Server was started in a previous session: `runserver 127.0.0.1:8000 --noreload` — **it has since exited (exit code 1, no Django traceback) around 19:01 local.** Restart from `server/`:
  ```powershell
  .\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000 --noreload
  ```
  Before resuming, rerun probe 001 smoke: `curl.exe -s http://127.0.0.1:8000/api/schema/`.
- Probe loop discipline (skill `sections/scope.md`, `exploratory.md`, `system-functional.md` — already read; browsers N/A functional-only): ONE probe per tool call; record status + body to `NNN-<contract>.json`; tokens never written to disk (login/refresh output saved only as prefix metadata); restore state via owned cleanup at the end.

### Probes done (all PASS unless noted)

| # | Probe | Result |
|---|---|---|
| 001 | `GET /api/schema/` smoke | 200 |
| 002/004 | register qa_probe_a_1017 (id=2), qa_probe_b_1017 (id=3) | 201 |
| 003 | register dup email (CI) | 400 `"User with this email already exists."` |
| 005 | login (sanitized: keys `refresh","access`) | 200 |
| 006 | login wrong password | 401 `no_active_account` |
| 007/008 | refresh rotation; replay old refresh | 200 rotate → 401 `"Token is blacklisted"` |
| 010 | A create category "Groceries" (expense) → id 1 | 201, no `owner` key |
| 011 | create `  groceries  ` (CI+trim dup) | 400 on `name` |
| 012 | create "Salary" (income) id 2 (fixture) | 201 |
| 013/014 | list ordered (name,id); `?type=income` | 200 correct |
| 015 | `?type=bogus` | 400 on `type` |
| 016 | retrieve cat 1 | 200 |
| 017 | PATCH rename → "Dining Out" | 200 |
| 018/019 | delete unreferenced "Solo Cat" (id 3) → replay delete | 204 → 404 `No Category matches the given query.` |
| 020 | A create txn: cat 1, `"23.45"`, expense, 2026-10-04 | 201 — `amount` IS `"23.45"` string, no `user` key. txn id = 1 |

Probe users (KEEP until cleanup step): qa_probe_a_1017 (id 2, password `Qa-Probe-2026!x`), qa_probe_b_1017 (id 3, same). Category ids A: 1=expense, 2=income. Txn id 1 exists (A, cat 1, 23.45, 2026-10-04).

### Remaining probe queue (in order, continue NNN counter at 021)

Transactions contract (A):
1. PATCH txn 1 amount → 200; later GET list reflects new amount (update visibility).
2. DELETE txn (create a disposable one first) → 204 → replay 404.
3. Filters: `?type=income&category_id=2` solo/combined vs fixtures; inclusive date range `2026-10-01..2026-10-31`; bad `type`, bad `category_id=abc`, bad `start_date=2026-13-01`, `start_date>end_date` → each 400 with field key.
4. Pagination: create 21 txns (loop) → `count=21`, `results`=20, `next` contains `page=2`; page 2 len 1.
5. Foreign category (B's category id) → 400 ≡ absent id 999999 400, **same message** no-existence-hint check.
6. Anon 401 on all five transaction routes (no `-H Authorization`).

Budgets contract (A): create overall (`category:null`) + scoped (`category:1`) 2026-10; response has `spent/remaining/is_over` and `spent == "0.00"` string (probes the money-bug fix live); reflection after txn 23.45 + a second txn → `spent "23.45"`; duplicate scope → 400 `non_field_errors`; PATCH limit → recompute; DELETE budget → txns survive; `?month=` filter + bad month 400 + bad `category_id` 400; income category → 400.

Reports contract (A): `monthly-summary?month=` (values match manual sums; strings; echoed month `YYYY-MM`); empty month zeros; breakdown `month+type` ordering `-total` then name tie-break; bad month/type 400s; `budget-status?month=` parity vs `/api/budgets/` rows (budget_id/category/limit/spent/remaining/is_over equal); status `[]` for month with no budgets.

Isolation (B token): B list categories → `[]`; categories/transactions/budgets detail 404; B summary for A's populated month → zeros; breakdown → `[]`; budget-status → `[]`; B foreign/absent txn category = same 400 body as A's.

Anon sweep: `/api/categories/`, `/api/transactions/`, `/api/budgets/`, 3 reports → all 401.

Evidence-file hygiene: PowerShell `Out-File` writes UTF-16 (reads as "binary") — write evidence with `[IO.File]::WriteAllText(path, content)`. Bodies: write JSON file via `[IO.File]::WriteAllText`, call `curl.exe -d "@abs_path"` (PS 5.1 mangles inline `-d` literals with spaces/quotes).

### Known QA findings so far (go into the report)

1. **HIGH (users app, pre-existing, outside my 4 epics):** `server/users/views.py` `UserView` = `GET /api/auth/users/` lists ALL users (id/username/**email**) to any authenticated caller — PII enumeration. PRD §7 (~line 139–145) + `client/AGENTS.md` instead specify `GET /api/auth/me/` and `POST /api/auth/logout/` (blacklist), **neither exists**; the client scaffold already targets `me/`. Per "Ask first: auth/token policy change" the users surface was left untouched — present to the user with a minimal-fix proposal (replace ListAPIView with RetrieveAPIView on `request.user`; add logout view blacklisting the submitted refresh token; drop `/users/`), let the user decide.
2. Environment note (not a product bug): PowerShell 5.1 mangles `\"`-escaped curl bodies — use `[IO.File]::WriteAllText` + `curl -d "@file"`.

### After the probe queue

- Phase 8 triage/fix loop if any probe fails (minimal fix + rerun probe + rerun affected tests).
- **Cleanup (owned state only):**
  ```powershell
  .\venv\Scripts\python.exe manage.py shell -c "from django.contrib.auth.models import User; User.objects.filter(username__startswith='qa_probe_').delete(); print('cleaned')"
  ```
  (CASCADE removes their txns/budgets/categories.) Then stop the background runserver.
- Write final report: `server/.gstack/qa-reports/run-20261021-functional/qa-report-api-2026-10-21.md` — contract map (pass/fail per row), findings with severity + fix status, remaining risks. qa skill completion format: STATUS/REASON/ATTEMPTED/RECOMMENDATION; degraded mode so no telemetry/log tool calls.

### Addendum (2026-10-21 ~19:00: server exit observations)

The runserver's console log before it terminated showed:

- `GET /health` → 404 every ~30s for ~45 min from an external poller. **No `/health` route exists** in this project (all `/health` matches in the repo belong to installed gstack skill docs). PRD does not define one — treat as noise unless the user says they attached a monitor that needs it.
- `OPTIONS /api/auth/login/` → 200 (DRF metadata) several times + one `POST /api/auth/login/` → **400 with a ~76-byte body** — consistent with a missing-field validation error, i.e. a caller sent a wrong-shaped login payload (suspect: client sends `username` instead of `email`). **Next-session probe:** review the client login page's request body; contract is `POST /api/auth/login/ {"email","password"}`. If the client sends `username`, that's a client bug against our documented contract, not a server bug.
- No CORS middleware is configured; no CORS-blockable pattern appeared in the log.

---

## 4. After QA — remaining plan (from original task)

1. **`/review` skill** (pre-landing review of the whole change set incl. uncommitted files across `server/`). Apply material findings; rerun affected tests after each fix.
2. **Docs status sync** (end of task):
   - `docs/epics/{categories,transactions,budgets,reports}.md` — mark epic status Done 2026-10-21.
   - `docs/specs/{01,02,03,04}-*.md` files that still say `Status: spec only` — mark implemented Done 2026-10-21 (all four epics).
   - Do NOT touch generated skill `.tmpl`-based files.
3. **Final PR-style summary** (report REAL numbers):
   - tests: users 6, categories 20, transactions 28, budgets 26, reports 20 = **100** (spec expectations ~20/23/20/18 — exceeded; do not trim).
   - schema: 14 `/api/` paths (auth 4 + categories/txns/budgets ×2 + reports ×3 + schema doc); transactions page size 20; money as strings; annotations/route/docs sync per root + server AGENTS.md.

## 5. Environment quick-reference

- Everything from `C:\Users\tamji\Documents\tamijid-workspace\expense-tracker\server\`.
- Tests ALWAYS `--keepdb` (Neon+pgbouncer holds sessions otherwise; if the test db is wedged, terminate sessions first — prior session used a `drop_test_db_once.py` one-off + `--keepdb` thereafter).
- Real exit signal is the `Ran N tests / OK` text, not the tool-reported exit code (PowerShell stderr noise reports `1`).
- Never print `server/.env` contents or `DATABASE_URL`; tokens/credentials never written to disk.
- Test-suite password: `StrongPass123`; QA probe users: `Qa-Probe-2026!x` (synthetic only).
- Auth header: `-H "Authorization: Bearer $tok.access"` built in the same shell call after a fresh login.
- `client/` scaffold exists now (React/Vite) — any API change must respect `client/AGENTS.md` contract lines.
