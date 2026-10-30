# Mobile Dashboard Hero — Short Design (2026-10-30)

## Intent / why
On phones, the home greeting ("Good morning, {name}") + Income / Expense totals read as plain text above 3 stacked KPI cards. User wants that info grouped in a single gradient card on mobile that feels like the site theme.

## Goals
- Mobile (`<md`): show gradient hero card with greeting, name, month label, Income + Expense totals side-by-side.
- Match theme: indigo primary `#4f46e5` family + existing `from-indigo-500 to-violet-500` accent (AppShell OverallBudgetCard), white text.
- Keep desktop (`md+`) exactly as today.

## Non-goals
- No change to desktop header layout.
- No change to `SummaryCards` (kept below hero, per user "dont replace").
- No new routes, API, or money-math changes.

## Anti-goals
- Don't duplicate greeting on mobile (hide plain header greeting on `<md`).
- Don't break contrast / readability on gradient; don't hardcode colors outside theme tokens.
- Don't do float money math; format decimal strings only.

## Constraints
- `client/src/features/dashboard/pages/DashboardPage.tsx:68-103` is the edit point; values from `useMonthlySummary(month)`.
- Tailwind v4; theme tokens in `client/src/index.css:59-60` (`--primary #4f46e5`).
- Money: `formatMoney()` / `<Money/>`, BDT, empty month = zeros not error.
- a11y: keep single `h1`, labeled loading states, `tabular-nums`.

## Approaches
- **A (picked): mobile-only hero `md:hidden`.** New gradient card at top with greeting + Income/Expense; desktop untouched. Minimal scope, exactly requested.
- **B (rejected): shared responsive hero for all sizes.** Same card everywhere. Rejected — changes desktop user didn't ask to change.

Picked A because request was explicitly scoped to mobile + "dont replace".

## What was decided
- Placement: top of `DashboardPage`, `md:hidden`; current plain greeting block becomes `hidden md:block` (or equivalent) to avoid double greeting.
- Content: `greeting(), name`, month `label`, Income total, Expense total, over/near-limit badges (adapted to translucent white style so they read on gradient).
- Style: `bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600` (light) — same hue as `--primary` + budget-bar gradient; rounded-2xl, white text, subtle white/10 inner divider, shadow. Dark mode: same gradient (brand color holds in dark per `index.css:94`).
- States: `summary.isPending` → skeleton shimmer in hero; no data → fallback copy already in header ("This month's income…").

## Left to builder
- Exact Tailwind classes, padding, skeleton sizes, badge variant on gradient (e.g. `bg-white/20 text-white` vs `secondary`).
- Whether net balance also shows in hero (proposal: no — SummaryCards already show it).
- `npm run typecheck` + `npm run build` verification.
