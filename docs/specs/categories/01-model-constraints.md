# SPEC C1: Category Model + Constraints + Migration

> Parent: `docs/epics/categories.md`. Stories S6, partly S3. Status: spec only, no code.
> Implements `prd.md:191-198`, FR-CAT-02/04/07. Rules: `server/AGENTS.md` Conventions.

## Context

Categories need a DB row that fixes ownership, name bounds, and duplicate rules under concurrent requests. App code alone cannot close the race. This spec is the foundation for C2–C4.

## Current State

Verified 2026-10-21: `server/categories/models.py:1-3` empty; `server/categories/migrations/__init__.py` only; no `Category` table; `server/schema.yml` auth-only.

## Proposed Change

Add `Category` with required `owner`, trimmed `name` 1–100, `type` in `income|expense`, timestamps, plus DB constraints. No null owner, no `is_active`, no seed rows per D2.

### Implementation Details

```python
# server/categories/models.py
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

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
        indexes = [models.Index(fields=["owner", "type"], name="idx_category_owner_type")]
```

Migration: single `0001_initial.py` via `makemigrations categories`. No data migration. SQLite local and Postgres (`docs/postgres-implementation.md`) both support `Lower()` unique.

Trimming lives in serializer (C2); DB keeps non-empty check as backstop. `on_delete=CASCADE` on owner: deleting a user removes their categories. Transactions FK added in Transactions epic with `on_delete=PROTECT` semantics enforced at view layer per D1.

## Acceptance Criteria

1. `makemigrations` + `migrate` creates table with three constraints and one index.
   - protects=schema lands; fails_when=migration missing constraint; no_claim=beyond DDL, no API yet.
2. Same owner + same lower(name) + same type rejected at DB level; same name across types or across owners allowed.
   - protects=FR-CAT-04 invariant; fails_when=dupe inserts; no_claim=API error shape is C2.
3. `owner=null` rejected; `name=""` rejected; `type="other"` rejected.
   - protects=FR-CAT-02/07; fails_when=null/empty/bad type saves; no_claim=serializer messages.
4. `python manage.py check` passes.
   - protects=config sanity; fails_when=check errors; no_claim=runtime behavior.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Unit | constraint names exist, `Lower` unique allows cross-type/cross-owner, rejects CI dupe | +3 |
| Integration | `migrate` fresh DB green | +1 |

## Rules for the implementing agent

1. Use `settings.AUTH_USER_MODEL`, never import `User` directly.
2. Keep constraint names exactly as above; used in `IntegrityError` mapping in C2.
3. No new dependency. No `schema.yml` change in this spec.

## Rollback Plan

Unreleased: `migrate categories zero`, delete `0001_initial.py`. Released with no dependents: second migration dropping table. If transactions table already references it, coordinate with Transactions epic revert.

## Effort Estimate

~2h: 1h model + 0.5h migration verify on SQLite + 0.5h Postgres `Lower()` sanity note.

## Files Reference

| File | Change |
|------|--------|
| `server/categories/models.py` | Add `Category` as above |
| `server/categories/migrations/0001_initial.py` | New via `makemigrations` |
| `server/categories/admin.py` | Optional register, local only |

## Out of Scope

Serializers, views, urls, filters, delete guard, tests beyond model, seed defaults, soft-delete.

## Related

- Epic `docs/epics/categories.md` C1. Next: `02-crud-api.md`.
- `prd.md:191-198`, `server/AGENTS.md:45-52`.
