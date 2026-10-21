# SPEC C3: Block-Delete Guard + Type-Change Guard

> Parent: `docs/epics/categories.md`. Stories S4/S5. Depends on `02-crud-api.md`. Status: spec only.
> Implements FR-CAT-05/06 per D1. Rules: `server/AGENTS.md`.

## Context

Deleting a category with history would corrupt reports and budgets. Flipping its `type` after transactions exist would mix income and expense totals. Both must be blocked with a clear 400, not a cascade.

## Current State

C1+C2 give CRUD without guards. `transactions` table does not exist yet; guard must be written to work both now (zero references) and later (references exist) without rework.

## Proposed Change

`DELETE` checks for referencing transactions; `PATCH type` checks the same when the value changes. No soft-delete, no reassign in MVP.

### Implementation Details

Delete (`destroy`):

```python
def perform_destroy(self, instance):
    from transactions.models import Transaction  # local import avoids cycle before app exists
    try:
        has_refs = Transaction.objects.filter(category=instance).exists()
    except Exception:
        has_refs = False  # transactions app not migrated yet -> allow delete
    if has_refs:
        raise ValidationError({"id": ["Category is referenced by transactions."]}, code="category_in_use")
    instance.delete()
```

Map to response `400 {"code":"category_in_use","detail":"Category has transactions and cannot be deleted.","fields":{"id":[...]}}`. Unreferenced delete returns 204 empty.

Type-change (`perform_update` / serializer `validate`):

- If `type` in input differs from `instance.type` and references exist, raise `ValidationError({"type": ["Cannot change type while transactions reference this category."]})` -> 400.
- `name` change always re-runs CI-unique check from C2.
- Use `select_for_update()` on the instance inside `transaction.atomic()` when checking + deleting/updating to close check-then-act race where practical.

Forward-compat: guard code must not crash when `transactions` app is absent. Local import + `apps.is_installed("transactions")` check preferred over bare try/except; document choice in PR.

## Acceptance Criteria

1. Unreferenced `DELETE` returns 204 and row gone; second `DELETE` returns 404.
   - protects=normal delete; fails_when=200 with body or 500; no_claim=in-use path.
2. Referenced `DELETE` returns 400 `category_in_use`, row still present, transactions untouched.
   - protects=FR-CAT-06 history; fails_when=cascade or 204; no_claim=reassign UX (out of scope).
3. `PATCH type` on referenced row returns 400; on unreferenced row returns 200.
   - protects=FR-CAT-05 consistency; fails_when=silent flip; no_claim=bulk migration.
4. Guard works with transactions app unmigrated (treats as zero refs, no crash).
   - protects=ordering C3 before txn epic; fails_when=ImportError 500; no_claim=txn-side enforcement.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Integration | 204 path, 404 repeat, 400 in-use with row-survives check, PATCH type 400 vs 200 | +4 |

Full assertions land in C4; fixtures create transactions directly once txn model exists, else stub the lookup.

## Rules for the implementing agent

1. Never cascade to transactions. Never null the FK.
2. Keep error `code` string stable: `category_in_use`.
3. Keep 404 concealment: existence of чуж referenced row still returns 404 before guard runs.

## Rollback Plan

Remove guard methods; behavior falls back to plain C2 delete. No migration change.

## Effort Estimate

~2h: 1h guards + 0.5h forward-compat + 0.5h manual checks.

## Files Reference

| File | Change |
|------|--------|
| `server/categories/views.py` | Add `perform_destroy` + type-change check, atomic + `select_for_update` |
| `server/categories/serializers.py` | Add type-change `validate()` branch |

## Out of Scope

Reassign flow, soft-delete column, transaction-side `category.type == transaction.type` enforcement (Transactions epic reuses this helper).

## Related

- Prev `02-crud-api.md`, next `04-tests-docs.md`. Stories S4/S5. Epic C3.
- `prd.md:89-90` FR-CAT-05/06, `server/AGENTS.md:49` budgets note on delete-never-deletes-txns (same principle).
