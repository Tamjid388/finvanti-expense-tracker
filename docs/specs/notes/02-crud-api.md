# SPEC N2: Note Serializer + CRUD API

> Depends on `01-model.md`. Status: implemented 2026-10-29.
> Routes `GET/POST /api/notes/`, `GET/PATCH/DELETE /api/notes/{id}/`. Rules: `server/AGENTS.md`.

## Context

Users need five working routes with owner isolation, newest-edited-first order,
and no PUT. This is the full notes API surface.

## Current State

Implemented: `serializers.py` (`NoteSerializer`), `views.py` (`NoteViewSet`), `urls.py` (router `""`, basename `notes`).

## Proposed Change

Serializer + viewset + router. `IsAuthenticated` only. Queryset always
`filter(owner=request.user)`. Miss returns 404. PATCH only — PUT excluded by
`http_method_names` design. Full spectacular annotations.

### Implementation Details

Serializer: fields `id`/`title`/`description`/`created_at`/`updated_at`;
`id`, `created_at`, `updated_at` read-only. `validate_title`: `strip()`,
reject empty, max 200. `validate_description`: max 2000. Client-sent `owner`
ignored; `perform_create` sets `owner=request.user` in `transaction.atomic()`.

Views: `NoteViewSet(ModelViewSet)`, `http_method_names = ["get", "post", "patch", "delete", "head", "options"]`.
`get_queryset`: `filter(owner=user).order_by("-updated_at", "-id")`. Destroy returns 204 with no body.

```http
POST /api/notes/ -> 201 {"id":1,"title":"...","description":"...","created_at":"...","updated_at":"..."}
GET /api/notes/ -> 200 [{...}] ordered (-updated_at, -id)
GET /api/notes/1/ -> 200 {...} or 404
PATCH /api/notes/1/ {"title":"New"} -> 200 {...} or 400/404
DELETE /api/notes/1/ -> 204
```
Errors: `201` create, `200` read/update, `204` delete, `400` validation,
`401` auth, `404` absent/concealed.

## Acceptance Criteria

1. Owner CRUD round-trip works; anonymous gets 401 on all five routes.
2. List ordered `(-updated_at, -id)`; empty store returns `[]`, not an error.
3. Empty/whitespace/`>200` title or `>2000` description returns 400; sent `owner` ignored.
4. Cross-user detail access returns 404 with no existence hint.

## Files Reference

| File | Change |
|------|--------|
| `server/notes/serializers.py` | `NoteSerializer` as above |
| `server/notes/views.py` | `NoteViewSet`, scoping, atomic, annotations |
| `server/notes/urls.py` | Router `""`, basename `notes` |
| `server/schema.yml` | Regenerated: `/api/notes/`, `Note`/`PatchedNote` |

## Out of Scope

PUT/bulk/search/filter params, sharing, attachments, model definition (N1).
