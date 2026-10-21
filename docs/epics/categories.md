# Epic: Categories — User-Owned Income/Expense Types

> Status: Done 2026-10-21 - implemented, 100-test suite green, live QA 71/71 PASS (server/.gstack/qa-reports/run-20261021-functional/qa-report-api-2026-10-21.md).
> Source of truth: `prd.md` §6.2, §7–§9, §13–§15. Backend rules: `server/AGENTS.md`.
> Decisions locked 2026-10-21 via `/spec` D1–D4 (block-delete, user-owned only, CI-unique 100 chars, single epic + PATCH).

## Context

Users need a small trusted set of income/expense categories to file transactions against. Without this, Phase 2 transaction CRUD has no valid `category` target, type-match checks (FR-CAT-05) cannot run, and Phase 3 budgets/reports have nothing to group by. This epic delivers the categories backend contract first so transactions, budgets, and reports can build on it.

Who cares: end users filing income/expenses by type; product needs clean breakdowns; engineering needs a stable FK target with ownership and deletion guarantees before transaction work starts.

## Current State

Verified 2026-10-21:

- `server/categories/models.py:1-3` — empty scaffold, no model.
- `server/categories/views.py:1-3` — empty scaffold, no views.
- `server/categories/urls.py:1-3` — `urlpatterns = []`, no routes.
- `server/categories/tests.py:1-3` — empty scaffold, no tests.
- `server/config/urls.py` — reserves `api/categories/` mount point (see `server/AGENTS.md` Architecture).
- `server/schema.yml` — auth-only snapshot, no category paths yet.
- `prd.md:83-92` — FR-CAT-01..07 defined, FR-CAT-06 deletion policy left open until this epic.
- `docs/wireframes/web/index.html` + `docs/wireframes/mobile/index.html` — category screens exist as UI reference only.

Result: `GET /api/categories/` does not exist. Transaction epic is blocked on this contract.

## Proposed Change

Add user-owned `Category` CRUD with `?type=` filter, case-insensitive uniqueness per owner+type, and blocked deletion when referenced. No system defaults in MVP. Owner always derives from `request.user`. Inaccessible objects return 404, never 403.

Routes (per `prd.md:147-154`, PATCH only, no PUT):

- `GET /api/categories/?type=income|expense`
- `POST /api/categories/`
- `GET /api/categories/{id}/`
- `PATCH /api/categories/{id}/`
- `DELETE /api/categories/{id}/`

### Implementation Details

Data model (`categories/models.py`):

```python
class Category(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=7, choices=[("income", "income"), ("expense", "expense")])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(Lower("name"), "owner", "type", name="uniq_category_owner_lower_name_type"),
            models.CheckConstraint(condition=~Q(name=""), name="category_name_nonempty"),
            models.CheckConstraint(condition=Q(type__in=["income", "expense"]), name="category_type_valid"),
        ]
```

Notes:

- Store `name` trimmed (`strip()` in serializer). Reject empty after strip with 400.
- `Lower("name")` uniqueness needs `django.db.models.functions.Lower`. Works on SQLite locally and Postgres in shared envs. Serializer adds a matching `validate()` so the 400 message is stable before the DB raises `IntegrityError` under race.
- No `owner=null`. No `is_active`. No system rows in MVP per D2.
- Add index on `(owner, type)` for list filter. `Meta.indexes` or rely on constraint prefix; state choice in child issue.

Serializer rules:

- Fields: `id`, `name`, `type`, `created_at`, `updated_at`. Never accept `owner`/`user` from client; ignore or reject if sent.
- `name`: strip, 1–100 chars.
- `type`: exactly `income` or `expense`.
- Duplicate (owner, lower(name), type) -> 400 with field-level error on `name`.

Views / permissions:

- `IsAuthenticated` default (per `config/settings.py`). `JWTAuthentication` only.
- Queryset: `Category.objects.filter(owner=request.user).order_by("name", "id")` for deterministic order.
- `perform_create`: `serializer.save(owner=request.user)` inside `transaction.atomic()`.
- Detail lookup scoped to owner; miss -> 404 (conceals existence, per `server/AGENTS.md`).
- Filter: `?type=` optional; invalid value -> 400. No pagination requirement for MVP (small set) but keep DRF default pagination setting unchanged; state in child issue if list stays unpaginated.
- `PATCH` partial update only. `type` change allowed only when no transactions reference the row; if referenced and `type` differs, return 400 (protects FR-CAT-05 history). `name` change re-checks CI uniqueness.
- `DELETE`: if `transactions` reference the id, return 400 with code `category_in_use`, do not delete. Else delete and return 204. No cascade to transactions. Per D1.
- Errors: `201` create, `200` read/update, `204` delete, `400` validation/in-use, `401` missing/invalid token, `404` absent/concealed, `429` throttled. `5xx` never leaks tracebacks.
- drf-spectacular annotations on every view so `python manage.py spectacular --file schema.yml` stays in sync.

Request / response shapes:

```http
POST /api/categories/
Authorization: Bearer <access>
Content-Type: application/json

{"name": "Food", "type": "expense"}
```

```http
201 Created

{"id": 12, "name": "Food", "type": "expense", "created_at": "2026-10-21T10:00:00Z", "updated_at": "2026-10-21T10:00:00Z"}
```

```http
GET /api/categories/?type=expense
```

```http
200 OK

[{"id": 12, "name": "Food", "type": "expense", "created_at": "...", "updated_at": "..."}]
```

```http
DELETE /api/categories/12/
-- when referenced --
400 Bad Request

{"code": "category_in_use", "detail": "Category has transactions and cannot be deleted.", "fields": {"id": ["Category is referenced by transactions."]}}
```

Cross-resource contract (for transaction epic):

- Transaction `category` must belong to `request.user` and `category.type == transaction.type`, else 400. Category epic defines the lookup helper / permission pattern; transaction epic reuses it.

## Child Issues

| # | Title | Spec | Priority | Effort | Status | Dependencies |
|---|-------|------|--------|--------|--------|--------------|
| C1 | Model + constraints + migration | `docs/specs/categories/01-model-constraints.md` | Critical | 2h | Planned | None |
| C2 | Serializers + CRUD views + urls + `?type=` filter | `docs/specs/categories/02-crud-api.md` | Critical | 4h | Planned | C1 |
| C3 | Block-delete guard + type-change guard | `docs/specs/categories/03-delete-guard.md` | High | 2h | Planned | C2 |
| C4 | Tests + `schema.yml` refresh + docs sync | `docs/specs/categories/04-tests-docs.md` | High | 4h | Planned | C2, C3 |

Total: ~12h (2h schema + 4h API + 2h guards + 4h tests/docs).

## Dependency Graph

```text
C1 Model ──> C2 API ──> C3 Delete/type guards ──> C4 Tests + schema
                                    │
                                    └─> blocks Transaction epic (FK + type-match)
                                        └─> blocks Budget + Report epics
```

## Sequencing Rationale

C1 first because DB constraints fix the duplicate and validity invariants under concurrent requests; app code alone cannot. C2 next because list/create/detail behavior sets the permission and filter pattern every later check reuses. C3 after C2 because the guard needs real list/detail paths to test 400 vs 204. C4 last so `schema.yml` and OpenAPI annotations describe the shipped guard behavior, not a draft. Transactions start only after C3 merges, or type-match tests will flap.

## Acceptance Criteria

1. Authenticated user can create, list, retrieve, PATCH, and delete own categories; anonymous requests get 401 on all five routes.
   - protects=owner CRUD works; fails_when=401 missing or 200 for anon; no_claim=does not prove cross-user isolation.
2. List `GET /api/categories/?type=expense` returns only that type for that user, ordered by `(name, id)`; invalid `type` returns 400.
   - protects=type filter; fails_when=leaks other type or 200 on bad value; no_claim=beyond single-page correctness.
3. `POST {"name":"Food","type":"expense"}` then `POST {"name":" food ","type":"expense"}` by same user returns 400 on second; different user can create `Food/expense` cleanly; same user can create `Food/income` cleanly.
   - protects=CI uniqueness per owner+type; fails_when=second create returns 201 or cross-user blocked; no_claim=race coverage needs C4 concurrency test.
4. `name` empty, whitespace-only, >100 chars, or `type` outside `income|expense` returns 400 with field errors; client-sent `owner` is ignored and record owner equals `request.user`.
   - protects=validation + server-side ownership; fails_when=trusts client owner or accepts bad name/type; no_claim=frontend copy.
5. User B `GET/PATCH/DELETE /api/categories/{id of user A}/` each return 404; `GET /api/categories/` for B never lists A rows.
   - protects=cross-user concealment; fails_when=403 leak or list leak; no_claim=transaction/budget isolation (separate epics).
6. `DELETE` on a category referenced by any transaction of the same user returns 400 `category_in_use` and the row still exists; unreferenced delete returns 204 and row is gone.
   - protects=history preservation per D1; fails_when=cascade delete or 200 with body; no_claim=soft-delete UX (out of scope).
7. `PATCH` changing `type` on a referenced category returns 400; on unreferenced category returns 200 and later transactions must use the new type.
   - protects=type-history consistency; fails_when=silent type flip on referenced row; no_claim=bulk type migration.
8. `server/schema.yml` regenerated via `spectacular --file schema.yml` documents all five routes, query params, and error shapes; Swagger UI loads without warnings.
   - protects=docs sync per root `AGENTS.md`; fails_when=route missing or annotation warning; no_claim=runtime perf.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Unit | `name` strip/length, `type` choices, CI-unique constraint, non-empty check | +4 |
| Integration | CRUD happy paths, `?type=` filter + ordering, 400 shapes, PATCH type-change guard, DELETE 400-in-use vs 204, client-owner ignored, anonymous 401 | +10 |
| Security | cross-user list/detail/PATCH/DELETE 404, related-id tampering via transaction epic contract note | +4 |
| Concurrency | duplicate `POST` race returns single 201 + one 400/`IntegrityError` mapped to 400 | +1 |
| Docs | `manage.py check` clean, `spectacular --file schema.yml` diff reviewed, Swagger UI smoke | +1 |

PRD §14 contract applies: validation, CRUD, filtering, anonymous-denied, cross-user blocked per resource, related-ID tampering, refresh rotation untouched. Do not lower thresholds to get green.

## Rules for the implementing agent

1. Scope every queryset/mutation to `request.user`; 404 for inaccessible, never 403.
2. Never trust client `user`/`owner`; set owner server-side in `perform_create`.
3. Money rules do not apply here (no amounts), but `type` must stay `income|expense` everywhere.
4. Serializer validates; DB constraints enforce under race. Map `IntegrityError` on the unique constraint to 400.
5. Multi-step writes in `transaction.atomic()`.
6. Keep `prd.md`, `server/schema.yml`, and spectacular annotations in sync after route changes.
7. Never commit `SECRET_KEY`, tokens, passwords, `venv/`, `db.sqlite3`, `__pycache__`.

## Rollback Plan

Unreleased migration: revert PR (`migrate categories zero` locally, delete migration file). Released migration with no dependents yet: new migration dropping the table/constraints; no data backfill needed because transactions epic has not landed. If transactions already reference categories, deletion-guard behavior must stay; rollback then needs a coordinated transaction-epic revert — state in PR body.

## Effort Estimate

- C1 model + constraints + migration: ~2h
- C2 serializers + views + urls + filter + annotations: ~4h
- C3 delete/type guards + error shapes: ~2h
- C4 tests (19) + `schema.yml` + Swagger check: ~4h
- Total: ~12h. No new dependency. No infra change.

## Files Reference

| File | Change |
|------|--------|
| `server/categories/models.py` | Add `Category` model + `UniqueConstraint(Lower("name"), "owner", "type")` + checks + index |
| `server/categories/serializers.py` | New: trim/length/type validation, CI-duplicate check, owner read-only |
| `server/categories/views.py` | New: ModelViewSet or generics, owner scoping, `?type=` filter, atomic create, delete/type guards, spectacular annotations |
| `server/categories/urls.py` | New: router or explicit five routes under `api/categories/` |
| `server/categories/tests.py` | New: unit + API + security + race tests per Testing Plan |
| `server/categories/admin.py` | Optional: register for local inspection only |
| `server/config/urls.py` | Verify `api/categories/` include stays wired |
| `server/schema.yml` | Regenerate after routes land |
| `prd.md` | No change needed; this epic implements §6.2 as written |

## Out of Scope

- System-default / seeded categories (cut per D2; revisit after MVP).
- Soft-delete, `is_active`, and reassignment-on-delete flows (cut per D1).
- `PUT` (PATCH only), bulk create, search by substring, ordering params beyond `(name, id)`.
- Transaction, budget, report endpoints (separate epics; this epic only defines the category side of the type-match contract).
- Multi-currency, OCR, recurring, sharing, notifications (PRD §4 non-goals).
- `DATABASE_URL` / Postgres switch (see `docs/postgres-implementation.md`; no model change needed).

## Related

- `prd.md` §6.2 FR-CAT-01..07, §7 Categories routes, §8 Category model, §9 type-match + ownership rules, §13 acceptance, §15 Phase 2.
- `server/AGENTS.md` Conventions + Guardrails (owner scoping, 404 concealment, error codes).
- `docs/postgres-implementation.md` — no change; `Lower()` constraint is Postgres-safe.
- `docs/wireframes/web/index.html`, `docs/wireframes/mobile/index.html` — category UI reference for later `client/` work.
- Stories: `docs/stories/categories.md` (S1–S6 traceability).
- Specs: `docs/specs/categories/01-model-constraints.md`, `02-crud-api.md`, `03-delete-guard.md`, `04-tests-docs.md`.
- Reference: `docs/reference/categories-api.md`.
- Blocks: Transactions epic (`docs/epics/transactions.md` + FK + FR-CAT-05), then Budgets (`docs/epics/budgets.md`) + Reports (`docs/epics/reports.md`).

## Definition of Done

1. `python manage.py check` passes; `python manage.py test categories` passes (19 tests).
2. All eight acceptance criteria above verified against local `runserver` with Thunder Client or equivalent.
3. `python manage.py spectacular --file schema.yml` regenerated and diff reviewed; Swagger UI shows five category routes with params and errors.
4. No cross-user leak: manual check of list/detail/PATCH/DELETE as second user returns 404/empty.
5. Code reviewed, migration included, no secrets or financial payloads in logs, docs (`prd.md` alignment note + this epic status) updated.
