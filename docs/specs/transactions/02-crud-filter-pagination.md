# SPEC T2: Transaction CRUD + Filters + Pagination

> Parent: `docs/epics/transactions.md`. Depends on T1. Status: implemented 2026-10-21.
> Implements FR-TXN-01/07/08/10, routes `prd.md:155-163`.

## Context

Main txn surface: five routes with combined filters and stable paging for the wireframe list screen.

## Current State

`server/transactions/views.py:1-3`, `urls.py:1-3` empty; no serializer; mount `api/transactions/` reserved per `server/AGENTS.md`.

## Proposed Change

ViewSet `http_method_names=[get,post,patch,delete,head,options]`. Queryset `filter(user=request.user).select_related("category").order_by("-date","-id")`. `perform_create/update` set `user` atomically. Filters: `type` optional set-check; `category_id` int; `start_date/end_date` ISO dates, 400 on bad format or `start>end`. Keep default pagination; state page size in PR (do not disable). Spectacular annotations incl. filter params.

Serializer: `amount` Decimal 12,2 `coerce_to_string=True` >0; `type` set; `date` ISO; `description` allow blank max 500; `category` PrimaryKeyRelatedField (ownership/type-match in T3, basic existence here).

Shapes: see `docs/reference/transactions-api.md`.

## Acceptance Criteria

1. CRUD round-trip 201/200/204; anon 401.
   - protects=happy path; fails_when=anon 200; no_claim=isolation depth.
2. Combined filters return exact intersection in `-date,-id` order with pagination keys.
   - protects=FR-TXN-07; fails_when=wrong order/unpaged; no_claim=perf.
3. Bad date format or `start>end` or bad `type` returns 400 with `fields`.
   - protects=FR-TXN-08; fails_when=silent ignore; no_claim=message copy.
4. Empty description ok; >500 or bad date string 400.
   - protects=FR-TXN-10; fails_when=accepts; no_claim=UI.
5. Amount serializes as string `"45.00"`, never `45.0`.
   - protects=FR-TXN-04; fails_when=numeric; no_claim=calc.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Integration | CRUD, each filter solo + combined, pagination, ordering, 400 shapes, anon | +11 |
| Unit | amount/date/desc validators | +3 |

Asserted in T4.

## Rules

Scope to user; atomic writes; `select_related`; annotations match routes.

## Rollback

Revert views/urls/serializers; 404 again. T1 migration stays.

## Effort

~5h: 1.5h serializer + 2.5h views/urls + 1h manual.

## Files Reference

| File | Change |
|------|--------|
| `server/transactions/serializers.py` | New |
| `server/transactions/views.py` | New viewset + filters |
| `server/transactions/urls.py` | New routes |

## Out of Scope

Ownership/type-match depth (T3), model (T1), full suite/schema (T4), PUT/bulk.

## Related

Prev `01`, next `03-ownership-typematch.md`. Reference `docs/reference/transactions-api.md`.
