# SPEC N1: Note Model + Constraints + Migration

> Stories: standalone personal notes, owner-isolated. Status: implemented 2026-10-29.
> Rules: `server/AGENTS.md` Conventions. Notes are out of MVP scope (`prd.md` unchanged).

## Context

Users need a DB row for standalone notes with ownership, title bounds, and
timestamps. No sharing, no categories FK, no uniqueness rule — only non-empty
title backstop at the DB level.

## Current State

Implemented: `server/notes/models.py` defines `Note`; migration `0001_initial.py`
creates the table with one check constraint and one index.

## Proposed Change

`Note` with required `owner`, trimmed `title` 1–200, free-text `description`
blank-allowed, timestamps. Meta ordering `(-updated_at, -id)` matches list order.

### Implementation Details

```python
# server/notes/models.py
owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notes")
title = models.CharField(max_length=200)
description = models.TextField(blank=True, default="")
created_at = models.DateTimeField(auto_now_add=True)
updated_at = models.DateTimeField(auto_now=True)

class Meta:
    ordering = ["-updated_at", "-id"]
    constraints = [models.CheckConstraint(condition=~Q(title=""), name="note_title_nonempty")]
    indexes = [models.Index(fields=["owner", "-updated_at"], name="idx_note_owner_updated")]
```

Trimming lives in the serializer; DB keeps the non-empty check as backstop.
`on_delete=CASCADE`: deleting a user removes their notes.

## Acceptance Criteria

1. `makemigrations` + `migrate` creates table with constraint `note_title_nonempty` and index `idx_note_owner_updated`.
2. `owner=null` rejected; `title=""` rejected; duplicate titles allowed (no uniqueness).
3. `python manage.py check` passes.

## Files Reference

| File | Change |
|------|--------|
| `server/notes/models.py` | `Note` as above |
| `server/notes/migrations/0001_initial.py` | New via `makemigrations` |

## Out of Scope

Serializers, views, urls, tests, seed rows, soft-delete, sharing, search.
