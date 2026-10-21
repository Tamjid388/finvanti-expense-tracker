# Personal Expense Tracker - PRD

**Product:** Personal Expense Tracker
**Document status:** MVP specification
**Version:** 1.0
**Last updated:** 2026-10-20
**Related documentation:** API Endpoint List & Business Logic

## 1. Executive Summary

Personal Expense Tracker is a secure, API-first application that helps individuals record income and expenses, organize transactions by category, plan monthly spending budgets, and understand their financial position through summaries and category-level reports. The first release prioritizes correctness, privacy, maintainability, and a small, testable MVP.

The initial implementation is a REST API built with Django, Django REST Framework, Simple JWT, and PostgreSQL. A frontend can consume the API later or be developed alongside it; this PRD does not mandate a frontend framework.

## 2. Problem Statement

People often lose track of daily spending and cannot easily determine where their money went by the end of a month. Manual notes and memory are unreliable, while an unstructured transaction list does not clearly show spending patterns or whether a budget has been exceeded.

The product should provide one reliable place to record financial activity and produce consistent, understandable summaries.

## 3. Goals and Success Criteria

### Product goals

- Allow users to securely create and manage their own income and expense records.
- Organize transactions into income or expense categories.
- Let users define monthly spending limits and compare actual spending with those limits.
- Provide accurate monthly totals, balances, category breakdowns, and budget status.
- Keep the MVP easy to test, document, deploy, and extend.

### MVP success criteria

- A user can register, authenticate, refresh a token, inspect their profile, and log out according to the token-revocation policy.
- Authenticated users can perform supported category, transaction, and budget operations.
- All financial records are isolated by authenticated user on the server.
- Reports return correct totals for empty months, populated months, and boundary dates.
- Invalid amounts, invalid dates, mismatched category types, and duplicate budgets are rejected consistently.
- Automated tests cover critical business rules and cross-user access.
- OpenAPI documentation is available for the implemented endpoints.

## 4. Non-Goals for MVP

The following are explicitly out of scope for the initial release:

- Bank account linking, payment processing, or automatic bank transaction imports.
- Multi-currency conversion or foreign-exchange calculations.
- Multiple wallets/accounts and transfers between accounts.
- Recurring transactions, bill reminders, push/email notifications.
- Receipt image uploads, OCR, or AI-generated financial advice.
- Shared household budgets, collaboration, and subscription billing.
- Investment tracking, credit scoring, or tax preparation.

These may be considered after the core MVP is stable and user feedback validates the need.

## 5. Target Users and Primary Use Cases

### Target users

- Students tracking allowances and everyday spending.
- Salaried professionals tracking income and monthly expenses.
- Freelancers tracking irregular income and costs.
- Individuals who want a simple monthly budget and spending overview.

### Representative user story

Rafi receives BDT 45,000 per month. He records salary as income, adds food, transport, rent, and shopping expenses, sets a monthly food budget of BDT 8,000, and checks a monthly report to understand total income, expenses, remaining balance, and budget status.

## 6. Scope and Functional Requirements

Priority definitions: **P0** = required for MVP; **P1** = desirable after core workflows; **P2** = future enhancement.

### 6.1 Authentication and Profile — P0

- **FR-AUTH-01:** A visitor can register using the required identity fields and password.
- **FR-AUTH-02:** The system validates required fields and rejects duplicate email addresses according to the chosen case-normalization policy.
- **FR-AUTH-03:** Passwords must be stored using Django's password hashing mechanisms; plaintext passwords must never be stored or logged.
- **FR-AUTH-04:** A user can log in and receive JWT access and refresh tokens.
- **FR-AUTH-05:** A valid refresh token can issue a new access token.
- **FR-AUTH-06:** A user can retrieve their own basic profile through an authenticated endpoint.
- **FR-AUTH-07:** Logout revokes/blacklists the refresh token when token blacklisting is enabled; the client also clears its local tokens. Access tokens remain usable only until expiry unless an additional revocation mechanism is implemented.
- **FR-AUTH-08:** Protected endpoints reject missing, invalid, or expired access tokens.

### 6.2 Categories — P0

- **FR-CAT-01:** Users can create, list, retrieve, update, and delete categories they own.
- **FR-CAT-02:** Each category has a name and type: `income` or `expense`.
- **FR-CAT-03:** Lists can be filtered by type.
- **FR-CAT-04:** The system prevents or consistently handles duplicate category names for the same user and type.
- **FR-CAT-05:** A transaction's category type must match the transaction type.
- **FR-CAT-06:** Categories already referenced by transactions must not be hard-deleted in a way that corrupts history. Block deletion, soft-delete, or use a documented reassignment policy.
- **FR-CAT-07:** If system-default categories are supported, they are read-only for ordinary users and cannot expose or mutate another user's data.

### 6.3 Transactions — P0

- **FR-TXN-01:** Authenticated users can create, list, retrieve, update, and delete their own transactions.
- **FR-TXN-02:** A transaction contains an ID, owner, category, positive amount, type, date, optional description, and timestamps.
- **FR-TXN-03:** Type must be `income` or `expense`; amount must be greater than zero.
- **FR-TXN-04:** Amounts are persisted using fixed-precision decimal storage and serialized as decimal strings to avoid floating-point money errors.
- **FR-TXN-05:** The category must belong to the current user or be an allowed system category, and its type must match the transaction type.
- **FR-TXN-06:** The owner is derived from the authenticated request, never trusted from client-supplied ownership fields.
- **FR-TXN-07:** Users can filter transactions by type, category, start date, and end date; list endpoints support pagination and deterministic ordering.
- **FR-TXN-08:** Date filters validate format and reject start dates later than end dates.
- **FR-TXN-09:** Updating or deleting a transaction must be reflected in subsequent summaries and budget calculations.
- **FR-TXN-10:** Empty descriptions are allowed; maximum lengths and accepted date/time behavior must be documented and validated.

### 6.4 Monthly Budgets — P0

- **FR-BUD-01:** Users can create, list, retrieve, update, and delete their own monthly budgets.
- **FR-BUD-02:** A budget includes a month, positive spending limit, owner, and optional expense category.
- **FR-BUD-03:** A category-specific budget can reference only an eligible expense category owned by the user or an allowed system category.
- **FR-BUD-04:** At most one budget exists for each user, month, and category scope. A database uniqueness constraint must enforce this rule; define how an overall budget (no category) is represented.
- **FR-BUD-05:** Budget list endpoints can filter by month and optionally by category.
- **FR-BUD-06:** Spent amount is calculated from matching expense transactions for the selected calendar month. For a category budget, only that category's expenses count.
- **FR-BUD-07:** Remaining amount equals limit minus spent amount. Negative remaining amount means the budget is over budget.
- **FR-BUD-08:** Exceeding a budget does not invalidate an otherwise valid transaction; it changes the reported budget status.
- **FR-BUD-09:** Deleting a budget never deletes historical transactions.

### 6.5 Reports and Analytics — P0

- **FR-REP-01:** Monthly summary returns the selected month, total income, total expenses, and net balance.
- **FR-REP-02:** Net balance is calculated as total income minus total expenses for the selected month. It is a monthly net figure, not necessarily the user's all-time cash balance.
- **FR-REP-03:** Category breakdown groups transactions by category and returns aggregated totals for the selected month and type.
- **FR-REP-04:** Budget status returns limit, spent, remaining, and over-budget state for each applicable budget.
- **FR-REP-05:** Empty months return zero totals and a zero net balance, not errors or null monetary totals.
- **FR-REP-06:** Report calculations must be restricted to the authenticated user and the requested period.
- **FR-REP-07:** Use database aggregation for totals and category grouping; avoid a separate query per category.
- **FR-REP-08:** Month boundaries must use a consistent documented date/time policy. For date-only transactions, filter inclusively by calendar date and avoid timezone-induced off-by-one errors.

### 6.6 API Documentation — P0

- **FR-DOC-01:** Publish OpenAPI/Swagger documentation using drf-spectacular.
- **FR-DOC-02:** Document authentication, request and response schemas, query parameters, status codes, validation errors, and example requests.
- **FR-DOC-03:** Keep documentation aligned with the implemented routes and serializers.

## 7. Information Architecture and API Surface

All paths below are proposed API routes and should be versioned consistently if versioning is adopted.

### Authentication

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/token/refresh/`
- `POST /api/auth/logout/`
- `GET /api/auth/me/`

### Categories

- `GET /api/categories/`
- `POST /api/categories/`
- `GET /api/categories/{id}/`
- `PATCH /api/categories/{id}/`
- `DELETE /api/categories/{id}/`

### Transactions

- `GET /api/transactions/`
- `POST /api/transactions/`
- `GET /api/transactions/{id}/`
- `PATCH /api/transactions/{id}/`
- `DELETE /api/transactions/{id}/`

Suggested filters: `type`, `category_id`, `start_date`, `end_date`, plus pagination and ordering parameters.

### Budgets

- `GET /api/budgets/`
- `POST /api/budgets/`
- `GET /api/budgets/{id}/`
- `PATCH /api/budgets/{id}/`
- `DELETE /api/budgets/{id}/`

Suggested filters: `month=YYYY-MM` and `category_id`.

### Reports

- `GET /api/reports/monthly-summary/?month=YYYY-MM`
- `GET /api/reports/category-breakdown/?month=YYYY-MM&type=expense`
- `GET /api/reports/budget-status/?month=YYYY-MM`

Detailed endpoint behavior and example payloads belong in the related API Endpoint List & Business Logic page. These routes are requirements, not a claim that they have already been implemented.

## 8. Data Model Requirements

### User

- Use Django's user model or a custom user model chosen at project start.
- Required identity fields and email uniqueness policy must be explicit.
- Passwords are managed by Django's authentication system.

### Category

- `id`: primary key.
- `owner`: user foreign key, nullable only if system defaults are supported.
- `name`: required bounded string.
- `type`: income or expense.
- `created_at`, `updated_at`: timestamps where useful.
- Add an appropriate uniqueness constraint for owner, normalized name, and type.

### Transaction

- `id`: primary key.
- `user`: required user foreign key.
- `category`: required category foreign key.
- `amount`: positive fixed-precision decimal.
- `type`: income or expense.
- `date`: date-only value unless a real transaction timestamp is a confirmed requirement.
- `description`: optional bounded text.
- `created_at`, `updated_at`: timestamps.
- Add indexes supporting owner/date filtering and common owner/type/date queries.

### Budget

- `id`: primary key.
- `user`: required user foreign key.
- `category`: nullable category foreign key for an overall budget, if that scope is supported.
- `month`: canonical first-of-month date or a consistently validated year-month representation.
- `limit_amount`: positive fixed-precision decimal.
- Add a database constraint preventing duplicate user/month/category scopes, including a deliberate strategy for nullable categories.

## 9. Business Rules and Calculations

- Money must never be calculated using binary floating-point arithmetic.
- Only expense transactions count toward spending budgets.
- Income transactions increase monthly net balance; expenses decrease it.
- Category type and transaction type must always match.
- Budget spending is derived from persisted transactions, not maintained as an independently mutable counter.
- Transaction create/update/delete operations must be reflected in report results without stale cached totals.
- Use server-side ownership filtering for every user-owned resource and related-object lookup.
- Define and consistently apply a policy for inaccessible resources (403 or 404); 404 is recommended where revealing existence would leak information.
- Use database constraints for invariants that must hold under concurrent requests.

## 10. Non-Functional Requirements

### Security and privacy

- Require authentication for all financial data endpoints.
- Enforce least privilege and object-level ownership checks on the server.
- Use HTTPS in deployed environments.
- Keep secrets and database credentials in environment variables or a secret manager; never commit them.
- Configure password validation, secure cookie/token handling where applicable, CORS, and production security settings.
- Use short-lived access tokens and an explicit refresh-token rotation/blacklisting policy.
- Do not log passwords, access tokens, refresh tokens, or unnecessary sensitive financial payloads.
- Apply rate limiting to authentication endpoints and consider API throttling for abusive traffic.
- Treat financial records as private user data and define backup, retention, and deletion behavior before production launch.

### Reliability and data integrity

- Validate data at serializer and database levels where appropriate.
- Use atomic database transactions for multi-step writes.
- Keep migrations reproducible and reviewed.
- Reports must remain consistent with the committed transaction data.

### Performance and scalability

- Add indexes based on expected filters and validate query plans for report queries.
- Use pagination for transaction lists; never return unbounded history by default.
- Use `select_related` / `prefetch_related` appropriately to prevent N+1 queries.
- Aggregate reports in the database.
- Add caching only after correctness and measured need; invalidate any derived data safely.

### Maintainability and observability

- Separate serializers, views, permissions, and complex report/query logic into clear modules or service/query layers as complexity grows.
- Use consistent API error shapes and structured application logs without secrets.
- Provide health checks and capture server errors in production monitoring.
- Pin dependencies and apply security updates.

### Accessibility and usability (for any frontend)

- Make core actions keyboard-accessible and label form fields clearly.
- Provide understandable validation feedback and loading, empty, success, and error states.
- Display currency consistently; BDT is the initial example currency, but multi-currency support is out of scope.
- Confirm destructive actions such as deleting a transaction or category.

## 11. Recommended Technical Stack

- **Language/runtime:** Python version supported by the selected Django release.
- **Backend:** Django + Django REST Framework.
- **Authentication:** Simple JWT; enable blacklist support if logout must revoke refresh tokens.
- **Database:** PostgreSQL for shared/deployed environments; SQLite may be used for local learning and early development.
- **Filtering/pagination:** DRF filtering and pagination facilities.
- **API schema:** drf-spectacular with Swagger UI / ReDoc as appropriate.
- **Testing:** pytest, pytest-django, and DRF API test utilities.
- **API exploration:** Thunder Client or an equivalent HTTP client.
- **Deployment:** environment-based configuration; Docker is recommended but not mandatory for the MVP.

## 12. Error Handling and API Conventions

- `201 Created` for successful resource creation.
- `200 OK` for successful reads and updates.
- `204 No Content` for successful deletes.
- `400 Bad Request` for malformed or invalid input.
- `401 Unauthorized` for missing or invalid authentication.
- `403 Forbidden` when authenticated access is disallowed, where that policy is used.
- `404 Not Found` for absent resources or consistently concealed inaccessible resources.
- `429 Too Many Requests` when throttling applies.
- `5xx` responses must not expose stack traces or internal secrets.
- Validation responses should identify invalid fields with stable, understandable messages.
- Use decimal strings for monetary values in JSON responses.

## 13. Acceptance Criteria

The MVP is accepted when all of the following are true:

- [ ] Registration validates input, hashes passwords, and rejects duplicate identities.
- [ ] Login, refresh, profile, and logout behavior match the documented token policy.
- [ ] Anonymous requests cannot read or mutate protected financial data.
- [ ] User A cannot list, retrieve, update, or delete User B's transactions, categories, or budgets.
- [ ] A transaction rejects zero/negative amounts, invalid type, invalid date, and category/type mismatch.
- [ ] Transaction list filters and pagination return correct, user-scoped results.
- [ ] Monthly summary correctly calculates income, expenses, and net balance.
- [ ] Category breakdown totals match the underlying transactions.
- [ ] Budget spent/remaining/over-budget values are correct for overall and category-specific scopes.
- [ ] Duplicate budgets are blocked by database constraints, including concurrent requests.
- [ ] Updating/deleting transactions changes subsequent report and budget results.
- [ ] Empty-month and month-boundary tests pass.
- [ ] OpenAPI documentation describes the implemented endpoints and errors.
- [ ] Critical automated tests pass in CI or the documented test environment.

## 14. Testing Strategy

### Unit tests

- Amount and date validation.
- Category/transaction type matching.
- Monthly boundary and balance calculations.
- Budget spent, remaining, and over-budget calculations.

### API integration tests

- Register/login/refresh/logout/profile.
- CRUD for categories, transactions, and budgets.
- Filtering, pagination, sorting, and validation error responses.
- Empty reports, populated reports, and date-boundary behavior.

### Security tests

- Anonymous access denied.
- Cross-user list/detail/update/delete blocked for every resource type.
- Related-object ID tampering blocked.
- Client-supplied owner/user IDs ignored or rejected.
- Refresh-token revocation and authentication throttling behavior tested.

### Database and regression tests

- Uniqueness and check constraints.
- Atomicity of multi-step writes.
- Transaction changes reflected in report results.
- Query count/performance checks for high-value list/report endpoints where practical.

## 15. Delivery Plan

### Phase 1 — Foundation and authentication

- [ ] Create Django project and apps.
- [ ] Decide custom-vs-default user model before first production migration.
- [ ] Configure environment settings and PostgreSQL.
- [ ] Implement registration, login, refresh, profile, logout, and permissions.
- [ ] Add authentication tests.

### Phase 2 — Categories and transactions

- [ ] Implement category model, constraints, serializers, and CRUD.
- [ ] Implement transaction model, constraints, serializers, and CRUD.
- [ ] Add ownership checks, filtering, pagination, and ordering.
- [ ] Add category and transaction tests.

### Phase 3 — Budgets and reports

- [ ] Implement monthly budget model and uniqueness constraints.
- [ ] Implement monthly summary, category breakdown, and budget status.
- [ ] Add aggregation and boundary tests.
- [ ] Verify update/delete effects on calculated results.

### Phase 4 — Hardening and release readiness

- [ ] Complete OpenAPI documentation.
- [ ] Configure production security settings and secrets.
- [ ] Add CI test execution, linting, and migration checks.
- [ ] Test backup/restore and deployment procedure.
- [ ] Run acceptance checklist and fix release-blocking defects.

## 16. Risks, Decisions, and Open Questions

### Risks and mitigations

- **Financial calculation errors:** use DecimalField, decimal strings, database aggregation, and calculation tests.
- **Cross-user data exposure:** centralize ownership filtering and add negative authorization tests for every resource.
- **Inconsistent budget totals:** derive spent values from committed transactions and avoid manually maintained counters.
- **Scope creep:** keep advanced features out until MVP acceptance criteria pass.
- **Ambiguous category deletion:** choose and document a policy before implementation.
- **Token logout expectations:** document that refresh-token revocation does not automatically invalidate already-issued access tokens.

### Decisions to confirm before implementation

- Is the first client API-only/Thunder Client, or will a web frontend be delivered in the MVP?
- Should an overall monthly budget (not tied to a category) be supported alongside category budgets?
- Should category deletion be blocked, soft-deleted, or reassigned when transactions reference it?
- Should email be the unique login identifier, and should email verification be required?
- Should logout revoke refresh tokens via the Simple JWT blacklist app?
- Is BDT the only currency for the MVP?
- What are the deployment target, expected user volume, and backup/retention requirements?

## 17. Definition of Done

A feature is done only when:

- Requirements and edge cases are implemented.
- Validation, permissions, and database constraints are in place.
- Unit and API tests cover success and failure paths.
- API documentation and examples are updated.
- No secrets or sensitive financial details are exposed in logs.
- Code is reviewed, migrations are included, and the feature works in the documented environment.
