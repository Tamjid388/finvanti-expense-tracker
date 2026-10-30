# Modal forms + mobile cards + bottom nav — design (Option A approved)

Date: 2026-10-30
Status: draft — awaiting human approval (do not build yet)

## Intent and why

Editing today prepends a full form `Card` above the list (`showForm ? <XForm/> : null` in 4 pages), pushing the table down and losing scroll position. User wants create + edit to open as a modal on all pages that do this append behaviour.

On mobile, `Table` in `overflow-x-auto` forces sideways scrolling. User wants rows as stacked cards with no scrollbar.

Mobile bottom tabbar has 7 equal tabs (`Dashboard/Home, Txns, Cats, Notes, Budgets, Reports, Profile`). User wants a `More` button holding `Reports, Profile, Notes`, with Transactions as a bigger circular middle button.

Who it's for: mobile-first expense tracking — thumb-reachable primary action (add/edit transaction), readable lists on 360px phones. Desktop stays as-is.

## Goals

- All create + edit for Transactions, Categories, Budgets, Notes open in the same modal. Same validation, per-field 400 errors, pending states, toasts, cancel/close. Esc, overlay click, and Cancel close without saving (discard, no confirm — matches today's Cancel; builder-check Q4 — call). Focus moves into modal and returns on close.
- Deep link `?new=1` opens the modal (current behaviour opens inline card — preserve the trigger, change the container). All 4 form pages already support `?new=1` via `useSearchParams`; keep exact open logic, no URL mutation on close/success (same as today; builder-check Q2 — call).
- Success keeps today's per-page `onSuccess` (builder-check Q3 — from code): close modal + `setEditing(null)` + existing toast; Transactions create also `setPage(1)`.
- Mobile (<md): Transactions list and Reports budget-status render as cards, no `overflow-x` scrollbar. Every field + edit/delete actions present on the card. Categories/Budgets/Notes already render as card grids (no `<table>`) — no change there (verified in code; builder-check Q1).
- Desktop (>=md): unchanged tables.
- Mobile tabbar (`AppShell.tsx:248 MobileTabBar`, `md:hidden`): 5 slots — Home (Dashboard), Categories, center Transactions FAB, Budgets, More. FAB is a plain link to `ROUTES.transactions` (no `?new=1`), circular, slightly larger (`size-14`, `-translate-y-4`, `bg-primary`). More is a button that only opens the menu (not a route); active/dot shows when Reports/Profile/Notes route is active. No count badges in `MobileTabBar` today (sidebar txn count stays desktop-only; builder-check Q5 — call). Safe-area padding kept. Keyboard accessible.
- Desktop sidebar + Topbar unchanged.

## Non-goals

- No API/auth/money-math changes. No change to filter, pagination, `month=YYYY-MM` handling, empty-month zeros.
- No new backend routes. No change to delete `ConfirmDialog` (stays `AlertDialog`).
- No desktop nav redesign. No change to Dashboard/Profile pages (no inline forms there).

## Anti-goals (failure even if it works)

- Modal that hides validation errors, traps focus, or can't be closed by keyboard.
- Mobile cards that drop a column (e.g. hiding amount/type/actions) or break screen-reader names for edit/delete.
- Bottom bar that crowds (6+ equal tabs), clips the FAB, or hides the active section with no indication inside More.

## Constraints

- Stack: React 19 + Vite + TS, Tailwind v4 mobile-first (`hidden md:block`, `md:hidden`), shadcn/radix (`radix-ui@1.8.1` already in deps, `DropdownMenu` exists, no `Dialog`/`Sheet` component yet — add one following `alert-dialog.tsx` pattern), `cn()` for classes, PRD §10 a11y (labels, focus, understandable errors).
- Forms today are outer-`Card` wrapped (`TransactionForm`, `CategoryForm`, `BudgetForm`, `NoteForm` each return `<Card><CardHeader><CardTitle>…`). Dialog + Card double-frames badly — refactor needed (see approach).
- Existing page state pattern `showForm + editing + openCreate/openEdit` stays; only the container changes from inline to modal. Keep `key={editing?.id ?? "new"}` reset behaviour (Notes already does this).
- Client guardrails: no hard-coded secrets, no change to `src/api/schema.d.ts`, keep `server/schema.yml` in sync if contract drifts (no drift expected).

## Approaches considered

### A — shared FormDialog + dual-render cards + 5-tab FAB bar (chosen)

- New `src/components/shared/FormDialog.tsx` on `Dialog` primitive from `radix-ui` (same overlay/content/focus pattern as `alert-dialog.tsx`), `max-w-lg`, `p-0` content, title via page (`Add/Edit transaction` etc.).
- Refactor 4 forms to expose bare content (either remove outer `Card` or add `bare` prop with `border-0 shadow-none`), render inside `FormDialog`. Pages change `{showForm ? <Form/> : null}` to `<FormDialog open={showForm} onOpenChange={close} title=…><Form …/></FormDialog>`. One a11y fix benefits all pages.
- Tables: keep `<Table className="hidden md:table">` (or wrapper `hidden md:block`), add `<div className="grid gap-3 md:hidden">` cards with same data, `Badge`/`Money` reuse, same `openEdit`/`setDeleting` handlers. Reports budget-status same treatment.
- Tabbar: 5 slots as above. More uses existing `DropdownMenu` (`side="top"`, `align="end"`) — no new dep. FAB is a `NavLink` to `ROUTES.transactions`, circular, elevated.
- Trades: more files touched, but correct `dialog` semantics, no duplicated focus logic, mobile has zero horizontal scroll.

### B — reuse AlertDialog + CSS data-label tables + 8-tab bar (rejected)

- Put forms in existing `AlertDialogContent`, tables responsive via `td::before data-label` stacking, tabbar keeps 7 + More as 8th with enlarged middle.
- Rejected: AlertDialog has wrong ARIA role for forms, `max-w-sm` too narrow, CSS-label tables hurt screen readers, 8 tabs crowd 360px. User picked A.

Why A: matches why (no layout shift, no scroll, thumb reachability) and what exists (radix available, DropdownMenu available, dual-render is the Tailwind-idiomatic responsive pattern).

## What they decided

- Both create and edit go modal (not edit-only).
- Option A for all three workstreams.
- More holds exactly Reports, Profile, Notes. Direct tabs: Home, Categories, Budgets + center Transactions. (If builder finds a 5-slot conflict with `NAV_ITEMS` count badge on Transactions, keep badge on FAB dot only.)
- Increase avatar work from prior turn stays; not part of this design.

## What's left to the builder

- Exact `DialogContent` classes (`max-w-lg w-[calc(100%-2rem)] rounded-2xl` etc.), overlay opacity, animation — follow `alert-dialog.tsx` tokens.
- Whether forms lose outer `Card` entirely vs `className="border-0 shadow-none"` passthrough — builder's call, keep visual padding identical.
- Card field order on mobile (recommended Transactions card: top row date + type Badge + amount right-aligned; second row category + description truncated; bottom row edit/delete right-aligned with `aria-label` kept). Reports card: name + status Badge top, Limit/Spent/Remaining grid, same `Money` formatting.
- More menu exact component (DropdownMenu preferred; if upward overflow clips, fallback fixed bottom sheet div) and FAB active-state rule (active on `/transactions` incl. `?new=1`).
- Plan + tests via `/writing-plans` after this doc is approved. Verify with `npm run typecheck` (+ `vite build`) and manual 360px + desktop check.
