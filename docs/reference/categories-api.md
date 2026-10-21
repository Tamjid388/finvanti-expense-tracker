# Reference: Categories API

> Diataxis reference. Factual only; how-to lives in stories, rationale in epic/specs.
> Source: `prd.md` §7, §12. Auth: `server/AGENTS.md`. Wireframes: `docs/wireframes/*/index.html`.

## Auth

`Authorization: Bearer <access>` (15m). Refresh via `POST /api/auth/token/refresh/`. 401 means missing/invalid/expired; client retries refresh once then forces login per `client/AGENTS.md`.

## Resource

`Category { id: int, name: string 1–100 trimmed, type: income|expense, created_at: datetime, updated_at: datetime }`. `owner` never in payload; derived from token.

## Endpoints

### `POST /api/categories/` -> 201
Body `{"name":"Food","type":"expense"}`. Errors 400 field errors incl. dupe on `name`, 401.
Example in epic Proposed Change.

### `GET /api/categories/?type=` -> 200
Query `type` optional `income|expense`; invalid -> 400. Order `(name,id)`. Body array of Category.

### `GET /api/categories/{id}/` -> 200 | 404
404 covers absent and чуж rows.

### `PATCH /api/categories/{id}/` -> 200 | 400 | 404
Partial only. `name` re-trims and re-checks CI-unique. `type` change on referenced row -> 400.

### `DELETE /api/categories/{id}/` -> 204 | 400 | 404
Referenced -> 400 `{"code":"category_in_use","detail":"...","fields":{"id":[...]}}`. Else 204 empty.

## Status codes

`201` create, `200` read/update, `204` delete, `400` validation/in-use, `401` auth, `404` absent/concealed, `429` throttled. `5xx` never leaks traceback. Money n/a here; `type` vocab is `income|expense` everywhere.

## Examples

See `docs/epics/categories.md` Proposed Change and `docs/specs/categories/02-crud-api.md` Shapes.

## Related

- Epic `docs/epics/categories.md`, specs `docs/specs/categories/`, stories `docs/stories/categories.md`.
- `server/schema.yml` (regenerated in C4), Swagger `/api/schema/swagger-ui/`.
