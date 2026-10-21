# QA report — expense-tracker API (functional live run, 2026-10-21)

- Target: Django/DRF API at `http://127.0.0.1:8000` (runserver `--noreload`), Postgres/Neon backend
- Scope: categories, transactions, budgets, reports contracts + auth smoke + cross-user isolation + anon sweep
- Mode: `qa` skill, **degraded** (no `~/.claude/skills/gstack/bin/*` on this machine, no repo bin; no telemetry). Manual per-probe evidence capture as agreed.
- Evidence dir: `server/.gstack/qa-reports/run-20261021-functional/functional/` (73 `NNN-<contract>.json` files, probes 001–094)
- Tokens never written to disk; login/refresh evidence stored as key/prefix metadata only.
- Probes 001–020 by the prior session; 021–094 by the continuation session. All assertions below were executed live, not inferred.

## Outcome

**71/71 probes PASS. 0 failures. No Phase-8 fixes required (triage loop not entered).**

Contract map (all PASS):

| Contract | Probes | Result |
|---|---|---|
| Auth: register / dup-email-400 / login / bad-creds-401 / refresh-rotate / replay-blacklist-401 | 002–008 | PASS |
| Categories CRUD, CI+trim dup-400, type filter + bogus-400, retrieve, PATCH rename, delete-unreferenced-204, replay-404, referenced-delete-400 `category_in_use` | 010–019, 094 | PASS |
| Transactions CRUD, PATCH visibility, delete + replay-404, solo/combo filters, inclusive date range, 4 bad-filter-400s, foreign≡absent 400 (A and B), anon-401 ×5 routes | 020–037, 087–088 | PASS |
| Budgets: overall + scoped create with string `spent`/`remaining` + bool `is_over`, reflection after txns, duplicate-scope-400, PATCH recompute, delete-keeps-txns, month/category filters + bad-400s, income-category-400 | 040–052 | PASS |
| Reports: summary exact values + strings + echoed month, empty-month zeros, ordering `-total` then name, income breakdown, bad month/type-400s, budget-status parity vs `/api/budgets/`, empty-status `[]` | 060–072 | PASS |
| Isolation (B): own-list only, A detail-404 ×3, B summary zeros, B breakdown/status `[]` | 080–086 | PASS |
| Pagination: count=25, page1=20 + `next?page=2`, page2=5, cleanup restored count | 090–092 | PASS |
| Anon sweep: 3 resources + 3 reports all 401 | 093 (+037) | PASS |

Key verified values (Oct 2026, user A at report time, before cleanup):
summary `{"month":"2026-10","total_income":"100.00","total_expenses":"45.00","net_balance":"55.00"}`;
breakdown-expense `Dining Out 40.00` then `Coffee 5.00` (desc-total order);
budget-status row `{"budget_id":1,"category_id":null,"limit":"500.00","spent":"45.00","remaining":"455.00","is_over":false}` byte-equal to `/api/budgets/` row on all five fields.

## Findings

1. **HIGH (users app, pre-existing, outside the 4 epics): `GET /api/auth/users/` lists ALL users (id/username/email) to any authenticated caller — PII enumeration.**
   Unchanged from the prior session's note; budget/report/transaction/category code is not involved.
   PRD §7 + `client/AGENTS.md` specify `GET /api/auth/me/` and `POST /api/auth/logout/` (blacklist) instead — neither exists, and the client scaffold already targets `me/`.
   Per the "ask first: auth/token policy" rule the surface was left untouched. Proposed minimal fix (needs user approval):
   replace the users ListAPIView with a RetrieveAPIView on `request.user`, add a logout view that blacklists the refresh token, drop `/users/`.
   Status: **deferred to user decision** (not a regression from this work).
2. Environment note (not a product bug): PowerShell 5.1 mangles `\"`-escaped curl bodies — evidence used `[IO.File]::WriteAllText` + `curl -d "@file"` (prior session) and in-process Python HTTP (this session). No action needed.
3. Cleanup friction (not a product bug, worth a test-helper note): `Category.owner` is `PROTECT`, so `User.objects.filter(...).delete()` raises `ProtectedError` while probe categories exist.
   Cleanup used for this run (all synthetic state removed, both `qa_probe_*` users gone, server re-verified 200 after):
   delete probe `Transaction`s → probe `Budget`s → probe `Category`ies → probe `User`s.
   If a future QA harness adds a cleanup helper, it must follow that order. Status: **deferred / docs-only**.

## Remaining risks

- Refresh-rotation probes (007/008) were run by the prior session against now-rotated tokens; rotation behavior itself is covered by unit tests (6 users tests) and was green at last full run. No live re-probe after cleanup is possible (identities deleted) — acceptable, no code changed since.
- `PUT` on viewsets is disabled by design (`http_method_names` without `put` → 405); not live-probed, covered by router config + unit suite.
- Concurrent duplicate-scope/category races rely on DB unique constraints; probed only sequentially (400 mapping verified, race path covered by `IntegrityError` mapping code + tests).

## Addendum 2026-10-21 (post-QA, user-approved)

Finding 1 FIXED the same day. `server/users/views.py`: `UserView` (ListAPIView over all users) replaced by
`MeView` (RetrieveAPIView on `request.user`) + `LogoutView` (blacklists the supplied refresh token;
204 success, 400 missing/invalid, 401 anon). `server/users/urls.py`: `users/` dropped;
`me/` + `logout/` added with drf-spectacular annotations. `server/users/tests.py`: +7 tests
(own-profile shape, anon-401s, removed-route 404, logout-blacklist + refresh-replay-401, missing/invalid-400).
`server/schema.yml` regenerated: 15 `api/` paths, `users/` gone. Full suite re-run: **107 tests OK**
(100 + 7). Verified by: unit tests `users` 13/13 green, full suite 107 green, `manage.py check` clean,
schema path grep. The 73 QA evidence files above predate this change and remain valid:
no financial-endpoint code was touched.

## Completion

- STATUS: DONE
- REASON: full probe queue 001–094 executed live, 71/71 PASS, evidence on disk, synthetic state cleaned, server healthy.
- ATTEMPTED: transactions/budgets/reports/isolation/pagination/anon contracts per handoff queue + 1 extra referenced-delete probe (094).
- RECOMMENDATION: proceed to `/review`, then docs status sync; present Finding 1 to the user before any auth-surface change.
