# SPEC C4: Category Tests + schema.yml + Docs Sync

> Parent: `docs/epics/categories.md`. Covers all stories S1–S6 verification. Depends on C2+C3. Status: implemented 2026-10-21.
> Implements PRD §14 test contract for categories, §6.6 docs. Rules: `server/AGENTS.md` Testing.

## Context

C1–C3 are unverified until API, security, race, and docs checks run green and `schema.yml` matches routes. This spec closes the epic.

## Current State

`server/categories/tests.py:1-3` empty. `server/schema.yml` auth-only. Epic acceptance criteria 1–8 unproven.

## Proposed Change

Add 20 tests, regenerate schema, smoke Swagger, update epic status. Do not lower thresholds.

### Implementation Details

Tests (`server/categories/tests.py`, DRF `APITestCase`, JWT via `users` login helper):

- Unit (4): strip, length>100, bad type, `Lower` unique constraint exists.
- Integration (10): create 201, list ordering, `?type=` valid/invalid, retrieve 200, PATCH rename 200, PATCH dupe 400, DELETE 204 then 404, DELETE in-use 400 + row survives, PATCH type-change 400 vs 200, client-`owner` ignored, anon 401 on five routes.
- Security (4): B cannot list A rows; B detail/PATCH/DELETE A id each 404; `?type=` never leaks.
- Concurrency (1): two simultaneous same-user same-type same-lower-name POSTs -> one 201, one 400. Use `ThreadPoolExecutor` or serialized transaction test; map `IntegrityError` to 400.
- Run: `python manage.py test categories` green; `python manage.py check` clean; `python manage.py test users` still green.

Docs:

```powershell
python manage.py spectacular --file schema.yml
```

Review diff: five category paths, `type` query param, 201/200/204/400/401/404 components. Open `/api/schema/swagger-ui/` smoke. Update epic `Status` line and Child Issues to Done. Verify `grep -rE '\]\([^)]*\.md\)' docs/` has no broken links.

Counts: +20 tests. If count differs, state why in PR body per gstack validation discipline.

## Acceptance Criteria

1. `test categories` passes 20/20; `check` passes; no threshold lowered.
   - protects=suite green; fails_when=skip/threshold cut; no_claim=perf.
2. Security four pass: no cross-user leak, 404 concealment holds.
   - protects=isolation; fails_when=403 or data visible; no_claim=txn/budget isolation.
3. Race test proves single 201 + one 400.
   - protects=DB invariant under concurrency; fails_when=two 201s; no_claim=load perf.
4. `schema.yml` diff reviewed, Swagger UI loads with five routes and no warnings.
   - protects=FR-DOC-01..03 for categories; fails_when=missing path or warning; no_claim=client SDK.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Unit | validation + constraint | +4 |
| Integration | CRUD/filter/guards/owner/anon | +10 |
| Security | cross-user + tamper | +4 |
| Concurrency | duplicate race | +1 |
| Docs | check + spectacular + Swagger | +1 |

## Rules for the implementing agent

1. Real code + real tests in same change; no placeholder assertions.
2. Report any test/validator change on its own line with justification.
3. Never log tokens or payloads. Never commit `db.sqlite3`, `venv/`, `__pycache__`.

## Rollback Plan

Tests/docs only; revert commit restores prior `tests.py`/`schema.yml`. No migration.

## Effort Estimate

~4h: 2.5h tests + 0.5h race + 0.5h schema/Swagger + 0.5h epic/doc links.

## Files Reference

| File | Change |
|------|--------|
| `server/categories/tests.py` | New 20 tests |
| `server/schema.yml` | Regenerated |
| `docs/epics/categories.md` | Status + child status to Done |
| `docs/specs/categories/*.md` | Status lines to Done |

## Out of Scope

New routes, PUT, txn/budget/report tests (their epics).

## Related

- Prev C1–C3. Closes epic DoD 1–5. `prd.md:302-351` §13–14, `server/AGENTS.md:27-36`.
