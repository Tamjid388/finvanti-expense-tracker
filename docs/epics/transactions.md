# Epic: Transactions — User-Owned Income/Expense Records

> Status: Done 2026-10-21 - implemented, 100-test suite green, live QA 71/71 PASS (server/.gstack/qa-reports/run-20261021-functional/qa-report-api-2026-10-21.md).
> Source: `prd.md` §6.3, §7–§9, §13–§15. Backend rules: `server/AGENTS.md`.
> Depends on: `docs/epics/categories.md` (FK target + type-match contract).

## Context

Once categories exist, users need to record income and expenses against them. Without this, budgets have no spend to sum and reports have no rows to aggregate. This epic delivers the money core with Decimal safety, owner isolation, and deterministic filtering.

Who cares: end users filing daily spend; product needs correct totals; engineering needs a stable `Transaction` row that budgets/reports can Sum without N+1.

## Current State

Verified 2026-10-21:

- `server/transactions/models.py:1-3` — empty scaffold.
- `server/transactions/views.py:1-3` — empty scaffold.
- `server/transactions/urls.py:1-3` — `urlpatterns = []`.
- `server/transactions/tests.py:1-3` — empty.
- `server/schema.yml` — no transaction paths.
- `prd.md:93-104` FR-TXN-01..10 defined; description bound and ordering left to this epic.

## Proposed Change

Add `Transaction` CRUD with `?type=&category_id=&start_date=&end_date=`, pagination, deterministic ordering, Decimal-string amounts, date-only dates, and strict category ownership + type-match. Owner from `request.user`. Miss returns 404.

Routes (per `prd.md:155-163`, PATCH only):

- `GET /api/transactions/?type=&category_id=&start_date=&end_date=`
- `POST /api/transactions/`
- `GET /api/transactions/{id}/`
- `PATCH /api/transactions/{id}/`
- `DELETE /api/transactions/{id}/`

### Implementation Details

Model (`transactions/models.py`):

```python
class Transaction(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="transactions")
    category = models.ForeignKey("categories.Category", on_delete=models.PROTECT, related_name="transactions")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    type = models.CharField(max_length=7, choices=[("income", "income"), ("expense", "expense")])
    date = models.DateField()
    description = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="txn_amount_positive"),
            models.CheckConstraint(condition=Q(type__in=["income", "expense"]), name="txn_type_valid"),
        ]
        indexes = [
            models.Index(fields=["user", "date"], name="idx_txn_user_date"),
            models.Index(fields=["user", "type", "date"], name="idx_txn_user_type_date"),
            models.Index(fields=["user", "category", "date"], name="idx_txn_user_cat_date"),
        ]
```

Notes:

- `amount` Decimal, never float. Serialize as string (DRF `DecimalField(coerce_to_string=True)`).
- `date` date-only. No timestamp requirement in MVP.
- `description` 0–500 chars, `blank=True`. Whitespace kept except full-strip check? Empty allowed.
- `category` `PROTECT`: complements categories C3 view guard with DB backstop.
- Type-match enforced in serializer + DB? DB cross-table check not portable; enforce in serializer + `clean()` and cover with tests. Document as app-level invariant with DB ownership via FK.
- Ordering: `-date, -id`. Pagination: keep project default (state in spec; do not disable).

Serializer rules: `amount` string >0 max 12,2; `type` in set; `date` ISO `YYYY-MM-DD`; `category` id must belong to `request.user` and `category.type == input type` else 400 on `category`; ignore client `user`; `description` max 500.

Views: `IsAuthenticated`, queryset `filter(user=request.user).select_related("category").order_by("-date", "-id")`; `perform_create/update` set `user=request.user` atomically; filters `type`, `category_id`, `start_date`, `end_date` with 400 on bad format or `start_date > end_date`; `PATCH` only; `DELETE` 204.

## Child Issues

| # | Title | Spec | Priority | Effort | Status | Dependencies |
|---|-------|------|--------|--------|--------|--------------|
| T1 | Model + constraints + indexes + migration | `docs/specs/transactions/01-model-constraints.md` | Critical | 2h | Planned | Categories C1 |
| T2 | Serializers + CRUD + filters + pagination + ordering | `docs/specs/transactions/02-crud-filter-pagination.md` | Critical | 5h | Planned | T1 |
| T3 | Ownership + type-match + date guards | `docs/specs/transactions/03-ownership-typematch.md` | High | 2h | Planned | T2 |
| T4 | Tests + `schema.yml` refresh | `docs/specs/transactions/04-tests-docs.md` | High | 4h | Planned | T2, T3 |

Total ~13h.

## Dependency Graph

```text
Categories C3 ──> T1 Model ──> T2 API ──> T3 Guards ──> T4 Tests
                                           │
                                           └─> blocks Budgets + Reports epics
```

## Sequencing Rationale

T1 first for Decimal/check/index invariants. T2 next for list/create/filter surface. T3 after because guards need real paths. T4 last so schema describes shipped guards. Budgets/reports start after T3.

## Acceptance Criteria

1. Owner CRUD works; anon 401 on five routes.
   - protects=owner CRUD; fails_when=anon 200; no_claim=cross-user.
2. `amount` zero/negative/huge/float-junk rejected 400; stored Decimal serializes as string `"45.00"`.
   - protects=FR-TXN-03/04; fails_when=float math or numeric JSON; no_claim=frontend format.
3. `category` чуж or type-mismatched returns 400 on `category`; client `user` ignored.
   - protects=FR-TXN-05/06; fails_when=leak or trust client; no_claim=category creation.
4. Filters `type/category_id/start_date/end_date` + pagination + `-date,-id` ordering correct; bad date or `start>end` returns 400.
   - protects=FR-TXN-07/08; fails_when=silent ignore; no_claim=perf numbers.
5. Cross-user detail access 404; list never leaks.
   - protects=isolation; fails_when=403/leak; no_claim=budget isolation.
6. Update/delete reflects in later summary/budget reads (no stale totals).
   - protects=FR-TXN-09; fails_when=cached totals; no_claim=report math (Reports epic).
7. `description` empty ok, >500 returns 400; `date` non-ISO returns 400.
   - protects=FR-TXN-10; fails_when=accepts overlong; no_claim=UI copy.
8. `schema.yml` documents five routes + filters + error shapes; Swagger clean.
   - protects=FR-DOC; fails_when=missing path; no_claim=perf.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Unit | amount/type/date/description validators, Decimal string | +5 |
| Integration | CRUD, filters, pagination, ordering, 400 shapes, anon 401 | +11 |
| Security | cross-user 404 ×4, related-id tamper, client-user ignored | +6 |
| Docs | check + spectacular + Swagger | +1 |

PRD §14 applies. Do not lower thresholds.

## Rules for the implementing agent

1. Scope every queryset to `request.user`; 404 concealment; never trust client `user`.
2. Decimal only; `coerce_to_string=True`; never float.
3. `select_related("category")` on list/detail; paginate list.
4. Serializer validates; DB checks enforce under race; atomic multi-step writes.
5. Keep `prd.md`, `schema.yml`, annotations in sync. Never commit secrets/`db.sqlite3`/`venv/`.

## Rollback Plan

Unreleased: revert PR, `migrate transactions zero`. Released: new migration dropping table only if budgets/reports have not landed; else coordinated revert.

## Effort Estimate

- T1 2h + T2 5h + T3 2h + T4 4h = ~13h. No new dep. No infra change.

## Files Reference

| File | Change |
|------|--------|
| `server/transactions/models.py` | Add `Transaction` as above |
| `server/transactions/serializers.py` | New validation per above |
| `server/transactions/views.py` | New viewset, scoping, filters, atomic, annotations |
| `server/transactions/urls.py` | New five routes |
| `server/transactions/tests.py` | New ~23 tests |
| `server/config/urls.py` | Verify `api/transactions/` include |
| `server/schema.yml` | Regenerate in T4 |

## Out of Scope

Recurring, transfers, multi-currency, receipt OCR, category creation here (Categories epic), budget/report math (their epics), PUT/bulk.

## Related

- `prd.md` §6.3, §7 txn routes, §8 txn model, §9 rules, §13–15.
- `server/AGENTS.md`, `docs/epics/categories.md`, blocks `docs/epics/budgets.md` + `docs/epics/reports.md`.
- Stories `docs/stories/transactions.md`, specs `docs/specs/transactions/`, reference `docs/reference/transactions-api.md`.
- Wireframes category picker + txn list screens.

## Definition of Done

1. `check` + `test transactions` green.
2. Eight criteria verified via `runserver` + Thunder Client.
3. `spectacular --file schema.yml` diff reviewed; Swagger shows five routes.
4. No cross-user leak on manual second-user check.
5. Migration included, no secrets/logs leak.
