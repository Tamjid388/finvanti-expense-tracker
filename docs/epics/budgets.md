# Epic: Monthly Budgets — Limits with Derived Spend

> Status: Done 2026-10-21 - implemented, 100-test suite green, live QA 71/71 PASS (server/.gstack/qa-reports/run-20261021-functional/qa-report-api-2026-10-21.md).
> Source: `prd.md` §6.4, §7–§9, §13–§15. Rules: `server/AGENTS.md`.
> Depends on: `docs/epics/categories.md`, `docs/epics/transactions.md`.

## Context

Users set a monthly spending cap overall or per expense category, then compare actual spend. Budgets never block spending; they report status. Spend is always derived from committed expense transactions, never a stored counter.

## Current State

Verified 2026-10-21: `server/budgets/models.py:1-3`, `views.py:1-3`, `urls.py:1-3` (`urlpatterns = []`), `tests.py:1-3` all scaffolds. No budget paths in `schema.yml`. Decisions open until this epic: overall representation, null-unique strategy, month form.

Decisions locked here: overall budget = `category=null`; `month` = first-of-month `DateField`; `limit_amount` Decimal 12,2 >0; DB unique on `(user, month, category)` with `nulls_not_distinct=True`; `spent` derived; `remaining = limit - spent`; over-budget allowed; delete never deletes txns.

## Proposed Change

Budget CRUD with `?month=YYYY-MM&category_id=` filter plus computed `spent/remaining/is_over` on read. Owner from `request.user`. 404 concealment.

Routes (per `prd.md:165-173`, PATCH only):

- `GET /api/budgets/?month=YYYY-MM&category_id=`
- `POST /api/budgets/`
- `GET /api/budgets/{id}/`
- `PATCH /api/budgets/{id}/`
- `DELETE /api/budgets/{id}/`

### Implementation Details

Model:

```python
class Budget(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="budgets")
    category = models.ForeignKey("categories.Category", null=True, blank=True, on_delete=models.CASCADE, related_name="budgets")
    month = models.DateField()  # always first-of-month
    limit_amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "month", "category"], name="uniq_budget_user_month_cat", nulls_not_distinct=True),
            models.CheckConstraint(condition=Q(limit_amount__gt=0), name="budget_limit_positive"),
        ]
        indexes = [models.Index(fields=["user", "month"], name="idx_budget_user_month")]
```

Notes:

- `nulls_not_distinct=True` needs Postgres 15+ (Neon ok) and Django 6 emulation on SQLite. State fallback in spec if SQLite check fails: two partial `UniqueConstraint(condition=...)` instead.
- Serializer normalizes `month` input `YYYY-MM` to `YYYY-MM-01`, rejects bad format and non-expense category (overall `null` allowed; set category must be `type=expense` owned by user).
- Duplicate `(user, month, category)` maps `IntegrityError` to 400.
- Read computes: `spent = Sum(expense txns for user, month range, and category if set)`; `remaining = limit - spent`; `is_over = spent > limit`. No stored counter. Over-budget never blocks txn create.
- `DELETE` budget never touches transactions.

## Child Issues

| # | Title | Spec | Priority | Effort | Status | Dependencies |
|---|-------|------|--------|--------|--------|--------------|
| B1 | Model + null-unique + migration | `docs/specs/budgets/01-model-constraints.md` | Critical | 3h | Planned | T1 |
| B2 | CRUD + `?month=` filter + annotations | `docs/specs/budgets/02-crud-filter.md` | Critical | 4h | Planned | B1 |
| B3 | Spend/remaining calc + guards | `docs/specs/budgets/03-spend-calc.md` | High | 3h | Planned | B2 + T3 |
| B4 | Tests + `schema.yml` | `docs/specs/budgets/04-tests-docs.md` | High | 4h | Planned | B2, B3 |

Total ~14h.

## Dependency Graph

```text
Transactions T3 ──> B1 Model ──> B2 API ──> B3 Calc ──> B4 Tests
Categories C3 ──┘
```

## Sequencing Rationale

B1 first for null-unique invariant under race. B2 next for filter surface. B3 after because calc needs real txn rows. B4 last for schema reflecting computed fields.

## Acceptance Criteria

1. Owner CRUD works; anon 401.
   - protects=CRUD+auth; fails_when=anon 200; no_claim=cross-user.
2. `month` bad format, `limit` ≤0, `category` income-type or чуж returns 400; `category=null` overall succeeds.
   - protects=FR-BUD-02/03; fails_when=accepts bad; no_claim=calc.
3. Duplicate `(user, month, category)` incl. double overall returns 400, also under race.
   - protects=FR-BUD-04; fails_when=two rows; no_claim=perf.
4. `?month=` + `category_id` filter correct; invalid month 400.
   - protects=FR-BUD-05; fails_when=leak; no_claim=pagination.
5. `spent/remaining/is_over` match manual Sum of expense txns in month; income ignored; category scope filters correctly.
   - protects=FR-BUD-06/07; fails_when=counter drift; no_claim=report reuse.
6. Over-budget txn still 201; budget shows `is_over=true`, negative remaining.
   - protects=FR-BUD-08; fails_when=blocks txn; no_claim=notification.
7. `DELETE` budget 204 leaves txns intact.
   - protects=FR-BUD-09; fails_when=deletes txns; no_claim=category delete.
8. Cross-user 404; `schema.yml` documents five routes + computed fields.
   - protects=isolation+docs; fails_when=403/leak or missing path; no_claim=UI.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Unit | month normalize, limit>0, null-unique, expense-only category | +4 |
| Integration | CRUD, filters, dupe 400, spent/remaining math, over-budget, delete-keeps-txns, anon 401 | +11 |
| Security | cross-user 404, чуж category rejected | +3 |
| Concurrency | duplicate budget race single 201 | +1 |
| Docs | check + spectacular | +1 |

## Rules for the implementing agent

1. Scope to `request.user`; 404 concealment; never trust client `user`.
2. Decimal strings; `Sum` in DB; never float; never stored counter.
3. `transaction.atomic()` on create/update; map unique `IntegrityError` to 400.
4. Keep docs/schema in sync. No secrets.

## Rollback Plan

Unreleased: revert + `migrate budgets zero`. Released: drop-table migration only if reports have not consumed computed fields; else keep read path and revert calc only.

## Effort Estimate

B1 3h + B2 4h + B3 3h + B4 4h = ~14h.

## Files Reference

| File | Change |
|------|--------|
| `server/budgets/models.py` | Add `Budget` as above |
| `server/budgets/serializers.py` | New month/limit/category validation + computed fields |
| `server/budgets/views.py` | New viewset, scoping, filters, calc, annotations |
| `server/budgets/urls.py` | New five routes |
| `server/budgets/tests.py` | New ~20 tests |
| `server/schema.yml` | Regenerate in B4 |

## Out of Scope

Recurring budgets, rollover, notifications, income budgets (expense only per PRD), currency conversion.

## Related

- `prd.md` §6.4 + §9, `server/AGENTS.md:49`, `docs/epics/transactions.md`.
- Stories `docs/stories/budgets.md`, specs `docs/specs/budgets/`, reference `docs/reference/budgets-api.md`.

## Definition of Done

1. `check` + `test budgets` green.
2. Eight criteria verified via `runserver`.
3. Schema diff reviewed; Swagger shows computed `spent/remaining/is_over`.
4. Manual second-user isolation check passes.
