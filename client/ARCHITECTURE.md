# ARCHITECTURE.md — client/

> Frontend architecture and tooling for the Personal Expense Tracker.
> Decided by the user: **React + TanStack Query + React Router + shadcn/ui**.
> Aligned with: `prd.md` (§7 API surface, §10 UX, §12 conventions), `client/AGENTS.md`, `server/schema.yml`, and `docs/wireframes/web/`.
> Update this file whenever the stack or structure changes.

## 1. Guiding principles

- **API-first mirror of the backend.** Every screen maps to a documented endpoint in `prd.md` §7 / `server/schema.yml`. No invented endpoints.
- **Server state lives in TanStack Query.** Components never `fetch` directly; they read query hooks.
- **Feature-first folder layout.** Code is grouped by domain (auth, transactions, …), colocating API calls, hooks, components, and pages.
- **UI from shadcn/ui.** No design system to build; generated, owned components in `src/components/ui`, themed with Tailwind tokens to match the wireframes.
- **Auth and money rules are non-negotiable.** JWT in memory only; money as decimal strings, never float math. See `client/AGENTS.md`.

## 2. Tech stack (decided)

| Layer / Concern      | Tool                                        | Notes |
| -------------------- | ------------------------------------------- | ----- |
| UI framework         | **React 19**                                | SPA, client-rendered. |
| Build tool           | **Vite**                                    | Fast dev server, env-mode aware. |
| Language             | **TypeScript** (strict)                     | Types mirror `server/schema.yml`. |
| Server state / cache | **TanStack Query v5** (`@tanstack/react-query`) | All GET/POST/PATCH/DELETE flows, caching, invalidation. |
| Routing              | **React Router v7** (`react-router`)        | `createBrowserRouter` + protected routes. |
| UI components        | **shadcn/ui** (Radix primitives, copied into repo) | `src/components/ui`, customized via `components.json`. |
| Styling              | **Tailwind CSS v4**                         | Required by shadcn; tokens in `src/index.css` (CSS variables). |
| Icons                | lucide-react                                | Default icon set of shadcn. |

### Utilities to confirm at scaffold time (ask first per AGENTS.md)

| Concern            | Candidate                          | Notes |
| ------------------ | ---------------------------------- | ----- |
| Forms + validation | react-hook-form + zod              | Login/register/txn/category/budget forms with per-field 400 error display. |
| Testing            | Vitest + React Testing Library + MSW | API-mock tests listed in `client/AGENTS.md`. |
| Lint/format        | ESLint + Prettier                  | Standard config. |
| State/minor store  | plain React context                | Only needs: auth user, current month. No Redux/Zustand for MVP. |

## 3. High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│ UI layer   pages + feature components (thin, presentational)│
├─────────────────────────────────────────────────────────────┤
│ State layer  feature hooks: useQuery / useMutation           │
│              TanStack Query cache · query keys · invalidation│
├─────────────────────────────────────────────────────────────┤
│ API layer   endpoint fns (typed)        src/api/*.ts          │
│             HTTP client: fetch wrapper · Bearer inject        │
│             · 401 → refresh-once → retry → force login        │
├─────────────────────────────────────────────────────────────┤
│ Backend     Django REST API (JWT) — see server/schema.yml    │
└─────────────────────────────────────────────────────────────┘
```

Data flows one way: **component → query hook → api fn → HTTP client → Django**.
Overlays/toasts confirm success paths per wireframes; error banners + per-field messages on `400`.

## 4. Standard folder structure

```
client/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx                    # entry: createRoot(<App/>)
│   ├── App.tsx                     # providers: QueryClientProvider → RouterProvider
│   ├── index.css                   # Tailwind entry + shadcn CSS-variable theme
│   │
│   ├── router/                     # React Router wiring
│   │   ├── index.tsx               # createBrowserRouter, lazy pages
│   │   └── ProtectedRoute.tsx      # redirect to /login when unauthenticated
│   │
│   ├── api/                        # ONE call per backend endpoint (prd.md §7)
│   │   ├── client.ts               # fetch wrapper: base URL, Bearer, 401 refresh-once
│   │   ├── auth.ts                 # register / login / token refresh / logout / me
│   │   ├── categories.ts           # CRUD /api/categories/
│   │   ├── transactions.ts         # CRUD /api/transactions/ (+ filters, pagination)
│   │   ├── budgets.ts              # CRUD /api/budgets/ (+ month=YYYY-MM)
│   │   ├── reports.ts              # monthly-summary / category-breakdown / budget-status
│   │   └── query-keys.ts           # central query-key factory
│   │
│   ├── features/                   # ← the core of the app, grouped by domain
│   │   ├── auth/                   # login/register pages, token session store
│   │   ├── dashboard/              # summary cards + recent txns
│   │   ├── transactions/           # table, filters, form, pagination
│   │   ├── categories/             # list, form (type-aware), delete confirm
│   │   ├── budgets/                # month picker, limit form, remaining math
│   │   ├── reports/                # monthly summary, category breakdown, budget status
│   │   └── profile/                # me / logout
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn-generated primitives (button, input, dialog…)
│   │   ├── layout/                 # AppShell: sidebar nav + header per wireframe
│   │   └── shared/                 # Money, EmptyState, LoadingState, ErrorState,
│   │                               # ConfirmDialog, TypeSegmented (txnTypeSeg)
│   ├── hooks/                      # cross-feature hooks (e.g. use-month-param, use-debounce)
│   ├── lib/                        # cn(), money.ts (format BDT / sum in minor units),
│   │                               # dates.ts (month bounds, YYYY-MM helpers), constants.ts
│   ├── types/                      # User, Category, Transaction, Budget, Report DTOs,
│   │                               # Paginated<T>, field-error shapes (mirror schema.yml)
│   ├── config/                     # env.ts (VITE_API_BASE_URL), route paths, exposure limits
│   └── test/                       # setup.ts, msw handlers, test-utils (added with Vitest)
│
├── .env.example                    # VITE_API_BASE_URL=http://127.0.0.1:8000
├── .env                            # local only — NEVER committed (AGENTS.md guardrail)
├── components.json                 # shadcn CLI config
├── index.html
├── package.json
├── tsconfig.json                   # strict; path alias @/* → src/*
├── vite.config.ts
└── eslint.config.js · .prettierrc
```

### Rules for this structure

1. **Pages live inside features** (`features/<domain>/pages/*Page.tsx`); the router only imports them (lazy). Alternative (pages folder at `src/pages`) is only valid with a documented reason.
2. **Feature anatomy** is always the same, e.g. `features/transactions/`:

   ```
   features/transactions/
   ├── pages/TransactionsPage.tsx   # route target; composes the pieces below
   ├── components/                  # TransactionTable, TransactionForm, TransactionFilters
   ├── hooks/                       # use-transactions.ts (useQuery), use-save/del (useMutation)
   ├── api.ts                       # optional: feature-local call wrappers re-using src/api/*
   └── index.ts                     # public exports; import features via @/features/…
   ```
3. **`src/components/ui` vs `features/*`**: generic, reusable primitives go in `ui/`; anything with a domain term (Transaction, Budget) belongs to the feature.
4. **No cross-feature imports of internals.** Features expose through `index.ts`; shared logic sinks to `hooks/`, `lib/`, or `api/`.
5. **`types/` mirrors `server/schema.yml`.** Rename/sync types when the schema changes (PRD + schema.yml must stay in sync — root AGENTS.md).

## 5. Routing map

| Path                  | Page (lazy)                       | Wireframe screen | Primary API |
| --------------------- | --------------------------------- | ---------------- | ----------- |
| `/login`, `/register` | `auth/pages/LoginPage`, `RegisterPage` | auth gate   | `POST /api/auth/login|register/` |
| `/`                   | `dashboard/pages/DashboardPage`   | Dashboard        | reports monthly-summary, recent txns |
| `/transactions`       | `transactions/pages/TransactionsPage` | Transactions | `GET/POST/PATCH/DELETE /api/transactions/` |
| `/categories`         | `categories/pages/CategoriesPage` | Categories       | CRUD `/api/categories/` |
| `/budgets`            | `budgets/pages/BudgetsPage`       | Budgets          | CRUD `/api/budgets/?month=YYYY-MM` |
| `/reports`            | `reports/pages/ReportsPage`       | Reports          | `GET /api/reports/*` |
| `/profile`            | `profile/pages/ProfilePage`       | Profile          | `GET /api/auth/me/`, logout |
| `*`                   | inline NotFound                    | —               | — |

- All routes except `/login` + `/register` are wrapped in `<ProtectedRoute>`.
- Optional month/type/query params flow through search params and into query keys, so they stay shareable/bookmarkable.

## 6. Server-state conventions (TanStack Query)

- **One factory for keys** (`src/api/query-keys.ts`) — predictable invalidation:

  ```ts
  export const qk = {
    me: () => ["auth", "me"] as const,
    categories: (params) => ["categories", params ?? {}] as const,
    transactions: (filters, page) => ["transactions", { ...filters, page }] as const,
    budgets: (month) => ["budgets", month] as const,
    monthlySummary: (month) => ["reports", "monthly-summary", month] as const,
    categoryBreakdown: (month, type) => ["reports", "category-breakdown", month, type] as const,
    budgetStatus: (month) => ["reports", "budget-status", month] as const,
  };
  ```
- **Mutations invalidate what they change**: creating/deleting a category invalidates `categories` + `transactions` (type-match rules) + reports; budget mutations invalidate `budgets` + `reports.budget-status`.
- **Empty month = success**, not error: an empty report response renders the empty/zero state — never an error toast (PRD §12 / AGENTS.md).
- `staleTime`: modest per screen (e.g. 30–60s); global default in the `QueryClient`, tuned where needed.
- Error surfacing is centralized in `api/client.ts` (401 refresh, 429 toast) plus hooks that map `400` field errors to form inputs.

## 7. Auth & session flow (per client/AGENTS.md)

1. Access (15m) + refresh (1d, rotated, blacklisted) tokens live **in memory only** (module-level store in `features/auth/`) — not `localStorage`, not cookies for MVP.
2. `api/client.ts` attaches `Authorization: Bearer <access>` on every request.
3. On `401`: single refresh attempt → retry original request once → if that fails, clear tokens and redirect to `/login`.
4. Logout calls `POST /api/auth/logout/`, clears the in-memory session, resets the QueryClient cache, and navigates to `/login`.
5. `qk.me()` hydrates the user for the shell/avatar + `ProtectedRoute`.

## 8. Money & formatting rules (per root + client AGENTS.md)

- Backend sends decimal strings (`"45.00"`). Store and display strings as-is; `lib/money.ts` only formats.
- Display: consistent BDT format (e.g. `৳ 45.00`) — same util everywhere so screens never diverge.
- If math is ever needed (e.g. `remaining = limit − spent`), compute in **integer minor units (paisa)** or with a decimal lib — **never JS floats**. Prefer trusting backend-computed fields when provided.
- No currency conversion, no i18n currency — BDT only (PRD non-goal).

## 9. UI conventions

- Build screens to match `docs/wireframes/web/` (Dashboard, Transactions, Categories, Budgets, Reports, Profile) and mirror shared components: `TypeSegmented` (txn type filter wired to the category dropdown), `EmptyState`, `ConfirmDialog` (destructive deletes for txns/categories).
- Loading / empty / success / error states for every async surface (PRD §10).
- Keyboard-accessible controls, labeled inputs, stable validation copy — shadcn + Radix give the a11y base; tests cover the flows in `client/AGENTS.md`.

## 10. References

- `prd.md` — §7 API surface, §10 UX/a11y, §12 status codes, §15 delivery plan.
- `client/AGENTS.md` — API contract, guardrails, testing checklist.
- `server/schema.yml` + Swagger at `http://127.0.0.1:8000/api/schema/swagger-ui/` — live contract source of truth.
- `docs/wireframes/web/` (`index.html`, `styles.css`, `app.js`) — visual reference: layout, states, copy.
