# Mobile Dashboard Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile-only gradient hero card showing greeting + Income/Expense on the dashboard.

**Architecture:** New `MobileHeroCard` presentational component rendered at top of `DashboardPage` with `md:hidden`; existing plain header hidden on mobile to avoid duplication. Values flow from `useMonthlySummary`.

**Tech Stack:** React 19 + TypeScript strict, Tailwind CSS v4, shadcn/ui Card tokens, lucide-react icons, `formatMoney` / `<Money/>` decimal-string money.

**Spec:** `docs/superpowers/specs/2026-10-30-mobile-hero-design.md`

## Global Constraints

- Mobile-only hero: `md:hidden`; desktop header unchanged.
- Keep `SummaryCards` below hero — do not replace or restyle them.
- Money is decimal strings (e.g. `"45.00"`) — format with `formatMoney()` / `<Money/>`, never float math; BDT only.
- Theme: gradient `from-indigo-600 via-indigo-600 to-violet-600` derived from `--primary #4f46e5`; white text; `rounded-2xl`; dark mode keeps same gradient.
- Accessibility: single `h1` hierarchy (hero title is `p`/div styled, not a second `h1`), `tabular-nums`, skeleton has `aria-label`, badges readable on gradient.
- Empty month = zeros, not error — render values, not error toast.
- Verify with `npm run typecheck` and `npm run build` from `client/`.

## Review Focus

- Very long username/email overflows hero on 320px width — expect truncation, no horizontal scroll.
- `summary.isPending` shows skeleton, not `—` or `৳ 0.00` flash — expect shimmer placeholders.
- Empty month (zeros `"0.00"`) still renders Income/Expense rows — expect zeros, not fallback copy.
- Desktop `≥768px` never shows hero — expect `md:hidden` effective, no duplicate greeting.
- Dark mode white-on-gradient contrast — expect readable text, badges use `bg-white/20 text-white border-white/20`.

---

### Task 1: MobileHeroCard component

**Files:**
- Create: `client/src/features/dashboard/components/MobileHeroCard.tsx`
- Test: manual + `npm run typecheck` (no JS runner per `client/AGENTS.md`)

**Interfaces:**
- Consumes: `MonthlySummary` type from `@/types/api` (`total_income`, `total_expenses` as money strings); `formatMoney` from `@/lib/money`; `Skeleton` from `@/components/ui/skeleton`; `Badge` from `@/components/ui/badge`.
- Produces: `MobileHeroCard({ greeting: string; name: string; monthLabel: string; summary: MonthlySummary | undefined; isPending: boolean; overCount: number; nearCount: number }) => JSX.Element`

- [ ] **Step 1: Create `MobileHeroCard.tsx` with exact props signature above**

```tsx
// Props: greeting, name, monthLabel, summary, isPending, overCount, nearCount
// Layout: div.md:hidden > gradient card (from-indigo-600 via-indigo-600 to-violet-600, text-white, rounded-2xl, p-5, shadow-lg)
// Row 1: <p> greeting + name (text-sm text-indigo-100), month label
// Row 2: grid-cols-2 Income | Expense with labels (text-indigo-100 text-xs uppercase) + values (text-xl font-semibold tabular-nums, formatMoney or <Money/>)
// Badges row (if overCount/nearCount > 0): translucent white badges
// Pending: two <Skeleton className="h-7 w-24 bg-white/30" /> with aria-label="Loading totals…"
```

- [ ] **Step 2: Run typecheck to verify it compiles**

Run: `npm run typecheck` (in `client/`)
Expected: PASS with no TS errors

- [ ] **Step 3: Commit**

```bash
git add client/src/features/dashboard/components/MobileHeroCard.tsx
git commit -m "feat(dashboard): add mobile hero card component"
```

### Task 2: Integrate hero into DashboardPage

**Files:**
- Modify: `client/src/features/dashboard/pages/DashboardPage.tsx:66-103`
- Test: manual responsive check + `npm run build`

**Interfaces:**
- Consumes: `MobileHeroCard` from Task 1; existing `greeting()`, `name`, `label`, `summary`, `overCount`, `nearCount`.
- Produces: Dashboard renders hero on mobile only, no duplicate greeting.

- [ ] **Step 1: Render `<MobileHeroCard />` above existing header with `md:hidden` wrapper**

```tsx
// In DashboardPage return, first child of <div className="space-y-6">:
// <MobileHeroCard greeting={greeting()} name={name} monthLabel={label} summary={summary.data} isPending={summary.isPending} overCount={overCount} nearCount={nearCount} />
// Change existing <header> to <header className="hidden md:flex ..."> (keep flex-wrap items-center justify-between gap-3) so mobile shows only hero
```

- [ ] **Step 2: Verify responsive behavior**

Run: `npm run typecheck` then `npm run build` (in `client/`)
Expected: both PASS; manual: `<768px` shows gradient hero + SummaryCards, no plain greeting; `≥768px` shows plain header, no hero

- [ ] **Step 3: Verify empty-month and loading states**

Run: check with `month` having no data (zeros) and with throttled network (pending)
Expected: zeros render as `৳ 0.00`; pending renders skeletons in hero

- [ ] **Step 4: Commit**

```bash
git add client/src/features/dashboard/components/MobileHeroCard.tsx client/src/features/dashboard/pages/DashboardPage.tsx
git commit -m "feat(dashboard): show greeting and totals in mobile gradient hero"
```
