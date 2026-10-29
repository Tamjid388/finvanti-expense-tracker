# Notes — Short Design (2026-10-29)

## Intent and why
Add standalone personal notes to the Expense Tracker. Each note has Title (required) and Description (optional), with `created_at` / `updated_at` shown. Full CRUD, owner-private, on both Django API and React UI. User confirmed: standalone (not linked to transactions/budgets), full CRUD with timestamps visible, description optional, both client and server.

## Goals
- Full CRUD: create, list, retrieve, partial update (PATCH), delete for own notes.
- Owner-scoped: JWT user only sees own notes; 404 for absent/concealed (no leak).
- Timestamps read-only, shown in UI; list ordered newest-first.
- Both sides: `server/notes/` API + `client` `/notes` page following existing patterns.
- Tests + `server/schema.yml` refreshed; `python manage.py check` + suite green.

## Non-goals
- Search/filter (`?search=`), pagination params beyond default, tags, pinning, rich-text/markdown, attachments.
- Linking notes to transactions/budgets/categories, sharing, collaboration.
- Reminders/notifications, offline sync.

## Anti-goals
- Never expose another user's notes; never trust client `owner`/`user` fields.
- No float handling needed (no money); no cross-user ID tampering allowed.

## Constraints (from repo)
- `server/AGENTS.md`: `IsAuthenticated` default, `JWTAuthentication` only; `perform_create` sets owner server-side; `transaction.atomic()` on writes; Postgres via `DATABASE_URL` only; drf-spectacular annotations kept in sync.
- `client/AGENTS.md` + `ARCHITECTURE.md`: JWT in memory, 401 refresh-once then login; feature-first `features/notes/`, `src/api/notes.ts`, central `query-keys.ts`; loading/empty/error states; confirm destructive deletes; never hand-edit `schema.d.ts`.
- Root `AGENTS.md`: money/decimal rules N/A here; reports aggregation N/A; keep `prd.md`/`schema.yml`/annotations in sync.

## Approaches considered
1. **Pattern-follow full feature (picked):** new `notes` app mirroring `categories/` (model + serializer + `ModelViewSet` + router) + full `features/notes/` (`/notes` route, list, form dialog, delete confirm). Tradeoff: more files, but consistent, testable, extensible.
2. **Same API, slim UI:** same API, minimal React page (plain list + inline form). Tradeoff: faster, but diverges from categories/transactions page pattern; search/pagination later = rework. Rejected per consistency.
3. **Search-ready day one:** option 1 + `?search=` on title/description with debounced UI. Tradeoff: nicer for many notes, but extra API/UI/test surface unneeded now. Rejected as overbuild.

Picked 1 because it follows existing conventions exactly without building unasked search.

## Decided (user) vs proposal (builder-checkable)
- User-decided: standalone; Title + Description only; Description optional; show `created_at`/`updated_at`; full CRUD; both server + client.
- Proposal (my call, flag if wrong): Title trimmed, required, 1–200 chars (`CharField(max_length=200)`, DB non-empty check); Description optional longer text (`TextField(blank=True, default="")`, cap ~2000 chars in serializer); ordering `-updated_at, -id`; paginate list (page size 20 like transactions, or unpaginated like categories — builder picks categories-style unpaginated ordered list if simpler, must document choice).

## What the builder does
- Server: `notes/models.py` (`owner FK CASCADE related_name="notes"`, `title`, `description`, timestamps; `CheckConstraint` non-empty title; index `(owner, -updated_at)` or `(owner, updated_at)`); `serializers.py` (trim/validate, read-only id/timestamps); `views.py` (`ModelViewSet`, `get_queryset` filter by `request.user`, `perform_create` saves owner, PATCH-only + DELETE, `extend_schema` annotations); `urls.py` router; wire `config/urls.py` `api/notes/` + `INSTALLED_APPS`; migration; `notes/tests.py` (anon 401, CRUD, cross-user 404 list/detail/patch/delete, validation, timestamps read-only, ordering); refresh `schema.yml`.
- Client: `src/api/notes.ts`, `qk.notes(...)` keys, `features/notes/` (pages/NotesPage, components NotesList/NoteForm/DeleteConfirm, hooks use-notes/use-save/use-delete), router `/notes` in `ProtectedRoute`, nav entry, empty/loading/error states, 400 per-field errors, 401 handling via shared client.
- Docs: update `prd.md` §7/§8 if notes are in scope, keep annotations + `schema.yml` synced.

## Open builder calls
- Exact title max (200 proposed) and description cap (2000 proposed) if user doesn't override.
- List pagination: follow transactions (20/page) vs categories (unpaginated) — pick one and document.
