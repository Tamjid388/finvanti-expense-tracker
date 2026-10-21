# SPEC C2: Category Serializers + CRUD + Filter

> Parent: `docs/epics/categories.md`. Stories S1/S2/S3. Depends on `01-model-constraints.md`. Status: implemented 2026-10-21.
> Implements FR-CAT-01/02/03/04, routes `prd.md:147-154`. Rules: `server/AGENTS.md`.

## Context

Users need five working routes with owner isolation and `?type=` filter. This is the main API surface transactions will call into.

## Current State

Verified 2026-10-21: `server/categories/views.py:1-3` scaffold; `server/categories/urls.py:1-3` empty `urlpatterns`; no `serializers.py`; `server/config/urls.py` reserves `api/categories/` mount.

## Proposed Change

Add serializer + viewset/generics + urls. `IsAuthenticated` only, `JWTAuthentication` only. Queryset always `filter(owner=request.user)`. Miss returns 404. PATCH only. Full spectacular annotations.

### Implementation Details

Serializer (`server/categories/serializers.py`):

- Fields: `id` read-only, `name`, `type`, `created_at`/`updated_at` read-only.
- `validate_name`: `strip()`, reject empty, max 100. `validate_type`: in `income|expense`.
- `validate()`: CI-duplicate check excluding self on PATCH: `owner=user, type=type, name__iexact=stripped`.
- `Meta.extra_kwargs = {"owner": {"read_only": True}}`. If client sends `owner`/`user`, ignore it; `perform_create` sets it.
- On `IntegrityError` with `uniq_category_owner_lower_name_type` in message, raise `ValidationError({"name": ["Category with this name already exists."]})` for race safety.

Views (`server/categories/views.py`):

- `CategoryViewSet(ModelViewSet)` with `http_method_names = ["get", "post", "patch", "delete", "head", "options"]` (no PUT).
- `get_queryset`: `Category.objects.filter(owner=self.request.user).order_by("name", "id")`.
- `perform_create`: `serializer.save(owner=self.request.user)` in `transaction.atomic()`.
- `perform_update`: same atomic wrapper.
- Filter: `?type=` optional; `None` returns all; `income|expense` filters; else 400 `{"fields": {"type": ["Must be income or expense."]}}`.
- Permissions: default `IsAuthenticated` from `config/settings.py`; no object-level class needed beyond queryset scoping.
- Annotations: `extend_schema` on list/create/retrieve/partial_update/destroy with query param `type`, 201/200/204/400/401/404 shapes.

Urls (`server/categories/urls.py`): router or explicit paths `""`, `"<int:pk>/"`. Keep trailing slash per project convention.

Shapes:

```http
POST /api/categories/ -> 201 {"id":1,"name":"Food","type":"expense","created_at":"...","updated_at":"..."}
GET /api/categories/?type=expense -> 200 [{...}]
GET /api/categories/1/ -> 200 {...} or 404
PATCH /api/categories/1/ {"name":"Dining"} -> 200 {...} or 400/404
```

Errors: `201` create, `200` read/update, `400` validation, `401` auth, `404` absent/concealed, `429` throttled. `5xx` never leaks traceback.

## Acceptance Criteria

1. Owner CRUD round-trip works; anonymous gets 401 on all five routes.
   - protects=happy path + auth gate; fails_when=anon 200 or owner create 400; no_claim=cross-user isolation (C4 security tests).
2. `?type=expense` returns only expense rows ordered `(name,id)`; `?type=bogus` returns 400.
   - protects=FR-CAT-03; fails_when=leak or silent ignore; no_claim=pagination (unchanged default).
3. `POST Food/expense` then `POST " food "/expense` returns 400 on second; `Food/income` succeeds; second user `Food/expense` succeeds.
   - protects=FR-CAT-04 per D3; fails_when=201 on dupe or 400 cross-user; no_claim=concurrent race (C4).
4. Empty/whitespace/>100 name or bad type returns 400 with `fields` errors; sent `owner` ignored.
   - protects=validation + server ownership; fails_when=trusts client owner; no_claim=DB race mapping.
5. Cross-user detail access returns 404 with no existence hint.
   - protects=concealment per `server/AGENTS.md`; fails_when=403 or data leak; no_claim=txn isolation.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Integration | create/list/retrieve/PATCH shapes, filter + ordering, 400 shapes, owner-ignored, anon 401, cross-user 404 | +9 |
| Unit | serializer strip/length/iexact-excluding-self | +3 |

Covered fully in C4; this spec defines behavior C4 asserts.

## Rules for the implementing agent

1. Filter every queryset by `request.user`. Never read `request.data["owner"]`.
2. Wrap create/update in `transaction.atomic()`.
3. Map unique `IntegrityError` to 400, never 500.
4. Keep spectacular annotations matching routes; regenerate `schema.yml` in C4.

## Rollback Plan

Revert views/urls/serializers to scaffold; routes return 404 again. No migration to revert (C1 stays). Note transaction-epic branch if it already imports the serializer helper.

## Effort Estimate

~4h: 1h serializer + 2h views/urls/annotations + 1h manual Thunder Client check.

## Files Reference

| File | Change |
|------|--------|
| `server/categories/serializers.py` | New per above |
| `server/categories/views.py` | New viewset, scoping, filter, atomic, annotations |
| `server/categories/urls.py` | New routes |
| `server/config/urls.py` | Verify include, no logic change |

## Out of Scope

Delete-in-use guard and type-change guard (C3), model definition (C1), full test suite and `schema.yml` commit (C4), PUT/bulk/search.

## Related

- Prev `01-model-constraints.md`, next `03-delete-guard.md`. Epic C2.
- `prd.md:83-92,147-154`, `server/AGENTS.md:45-52`, reference `docs/reference/categories-api.md`.
