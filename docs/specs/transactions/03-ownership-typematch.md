# SPEC T3: Ownership + Type-Match + Date Guards

> Parent: `docs/epics/transactions.md`. Depends on T2 + Categories C3. Status: spec only.
> Implements FR-TXN-05/06. Rules: `server/AGENTS.md` 404 concealment.

## Context

Money must never attach to чуж category or mix income/expense types. Owner must come from token.

## Current State

T2 validates shape; ownership/type-match undefined beyond basic FK.

## Proposed Change

Serializer `validate()`:

- `category = Category.objects.filter(id=input, owner=request.user).first()`; miss -> `ValidationError({"category":["Invalid category."]})` 400 (covers both чуж and absent, no leak).
- If `category.type != input type` (on create, or on update using merged type/category), 400 on `category`.
- On PATCH, resolve effective `type`/`category` from input-or-instance before comparing.
- Ignore/strip `user`/`owner` keys in input; `perform_create/update` set `user=request.user`.
- `date` validated ISO; `start>end` handled in view filter (T2), single `date` always accepted if calendar-valid.

No DB cross-table check; app invariant + tests.

## Acceptance Criteria

1. чуж `category_id` returns 400, no hint whether id exists.
   - protects=isolation; fails_when=201 or 404 leak; no_claim=category fix.
2. Own category with `category.type != txn type` returns 400 on `category`.
   - protects=FR-TXN-05; fails_when=saves mismatch; no_claim=category type flip.
3. Sent `{"user":999}` ignored; row owner equals token user.
   - protects=FR-TXN-06; fails_when=trusts client; no_claim=admin override.
4. PATCH changing only amount keeps passing; changing category to mismatched fails.
   - protects=joint validation; fails_when=partial bypass; no_claim=bulk.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Integration | чуж id, mismatched create, mismatched PATCH, user-ignored | +4 |
| Security | B uses A category id -> 400 not 404-with-hint | +2 |

In T4.

## Rules

Queryset scoping + serializer lookup both filter by user. 400 for related-id problems, 404 only for txn id itself.

## Rollback

Remove validate branches; falls back to T2 shape checks.

## Effort

~2h.

## Files Reference

| File | Change |
|------|--------|
| `server/transactions/serializers.py` | Add validate ownership/type-match |
| `server/transactions/views.py` | Ensure user context passed to serializer |

## Out of Scope

Category delete guard (Categories C3), report math, budget math.

## Related

Prev `02`, next `04-tests-docs.md`. Epic acceptance 3/5.
