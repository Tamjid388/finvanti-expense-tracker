# SPEC B2: Budget CRUD + Month Filter

> Parent: `docs/epics/budgets.md`. Depends on B1. Status: spec only.
> Implements FR-BUD-01/02/03/05/09, routes `prd.md:165-173`.

## Context

Five routes with `?month=&category_id=` and delete-keeps-txns for the wireframe Budgets screen.

## Current State

`server/budgets/views.py:1-3`, `urls.py:1-3` empty; no serializer.

## Proposed Change

ViewSet PATCH-only. Queryset `filter(user=request.user).select_related("category").order_by("month","id")`. `perform_create/update` set `user` atomically. Month input `YYYY-MM` normalized to `YYYY-MM-01`, 400 on bad. `category` optional: `null` overall ok; if set must be owned + `type=expense` else 400. Filters: `month` exact normalized, `category_id` exact (plus `?category_id=null`? No: omit param means all; explicit `null` string 400 — document). `DELETE` 204 deletes only budget row. Annotations for filters + computed fields (computed in B3, declared here).

## Acceptance Criteria

1. CRUD 201/200/204; anon 401.
   - protects=happy path; fails_when=anon 200; no_claim=calc.
2. Bad month/limit≤0/income-чуж category/duplicate scope each 400 with `fields`.
   - protects=FR-BUD-02/03/04; fails_when=201; no_claim=spent math.
3. `?month=2026-10&category_id=12` intersection correct; bad month 400.
   - protects=FR-BUD-05; fails_when=leak; no_claim=calc.
4. DELETE leaves transactions listed.
   - protects=FR-BUD-09; fails_when=txns gone; no_claim=category delete.
5. Cross-user detail 404.
   - protects=isolation; fails_when=403/leak; no_claim=reports.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Integration | CRUD, filters, 400s, delete-keeps-txns, anon | +9 |

In B4.

## Rules

Scope to user; atomic; map unique IntegrityError to 400; annotations match.

## Rollback

Revert views/urls/serializers; B1 stays.

## Effort

~4h.

## Files Reference

| File | Change |
|------|--------|
| `server/budgets/serializers.py` | New month/limit/category + computed declarations |
| `server/budgets/views.py` | New viewset + filters |
| `server/budgets/urls.py` | New routes |

## Out of Scope

Spend math (B3), model (B1), suite/schema (B4).

## Related

Prev `01`, next `03-spend-calc.md`.
