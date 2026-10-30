# Modal Forms + Mobile Cards + Bottom Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all create/edit forms into a shared modal, render tables as cards on mobile, and rebuild the mobile tabbar with center FAB + More.

**Architecture:** Add one shared `FormDialog` on the existing `radix-ui` Dialog primitive (same pattern as `alert-dialog.tsx`); pages keep `showForm + editing` state but render the form inside the dialog. Tables use dual-render (`hidden md:block` table + `md:hidden` cards). Tabbar becomes 5 slots with existing `DropdownMenu` for More.

**Tech Stack:** React 19.3 + Vite 8.3 + TypeScript 7.0 strict, Tailwind CSS v4 mobile-first, shadcn/radix (`radix-ui@1.8.1`, `cn`), React Router 8.5, TanStack Query 5.104

**Spec:** `docs/superpowers/specs/2026-10-30-modal-forms-mobile-nav-design.md`

## Global Constraints

- Mobile-first Tailwind: desktop table `hidden md:block`, mobile cards `md:hidden`; tabbar `md:hidden`.
- No new runtime deps — use `radix-ui@1.8.1` Dialog primitive (already installed) following `src/components/ui/alert-dialog.tsx` tokens.
- Forms keep validation, per-field 400 errors, pending, toasts, `onCancel` discard (no dirty-confirm).
- `?new=1` keeps exact open logic on all 4 pages, no URL mutation on close/success.
- Success keeps today's `onSuccess`: close + `setEditing(null)` + toast; Transactions create also `setPage(1)`.
- Key remount: `key={editing?.id ?? "new"}` on form inside dialog (Notes already does this).
- A11y (PRD §10): labeled inputs, focus into dialog + return, Esc/overlay close, `aria-label` on edit/delete kept on cards.
- Never hand-edit `src/api/schema.d.ts`; verify with `npm run typecheck`.

## Review Focus

- 360px phone with long description/category name — card must truncate/wrap, no horizontal scroll, actions still reachable.
- Keyboard-only open/edit/close — focus enters dialog, Esc closes, focus returns to triggering Add/Edit button.
- Dirty form + Esc/overlay/Cancel — discards immediately with no confirm (spec call), no partial save.
- Empty month / zero rows — cards list shows EmptyState, not empty cards; Reports zeros still render.
- Stale `?new=1` on refresh — modal reopens (same as today); closing does not clear URL, refresh reopens.

---

### Task 1: Shared FormDialog primitive

**Files:**
- Create: `client/src/components/shared/FormDialog.tsx`
- Test: manual + `npm run typecheck` (no runner per `client/AGENTS.md`)

**Interfaces:**
- Consumes: `Dialog as DialogPrimitive` from `radix-ui`, `cn` from `cn`, tokens from `src/components/ui/alert-dialog.tsx`
- Produces: `FormDialog({ open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: React.ReactNode })`

- [ ] **Step 1: Create `FormDialog.tsx` with `open, onOpenChange, title, description?, children` using `DialogPrimitive.Root/Portal/Overlay/Content/Title/Description`.**
- [ ] **Step 2: Run typecheck to verify it compiles.**

  Run: `npm run typecheck` in `client/`
  Expected: PASS (exit 0)

- [ ] **Step 3: Manual check — render once in TransactionsPage behind a flag, open/close via Esc + overlay + Cancel returns focus.**
- [ ] **Step 4: Commit.**

  ```bash
  git add client/src/components/shared/FormDialog.tsx
  git commit -m "feat(client): add shared FormDialog on radix Dialog"
  ```

### Task 2: Move all 4 create/edit forms into the modal

**Files:**
- Modify: `client/src/features/transactions/components/TransactionForm.tsx`
- Modify: `client/src/features/categories/components/CategoryForm.tsx`
- Modify: `client/src/features/budgets/components/BudgetForm.tsx`
- Modify: `client/src/features/notes/components/NoteForm.tsx`
- Modify: `client/src/features/transactions/pages/TransactionsPage.tsx`
- Modify: `client/src/features/categories/pages/CategoriesPage.tsx`
- Modify: `client/src/features/budgets/pages/BudgetsPage.tsx`
- Modify: `client/src/features/notes/pages/NotesPage.tsx`

**Interfaces:**
- Consumes: `FormDialog` from Task 1
- Produces: pages export same component names; `openCreate()` / `openEdit(item)` set `showForm=true`; dialog `onOpenChange(false)` calls `setShowForm(false); setEditing(null)`

- [ ] **Step 1: Strip outer `Card/CardHeader/CardTitle` from the 4 forms to bare `<form>` content (or `bare` prop with `border-0 shadow-none`), keeping all fields, ids, errors, buttons.**
- [ ] **Step 2: Replace `{showForm ? <XForm/> : null}` in all 4 pages with `<FormDialog open={showForm} onOpenChange={close} title={editing ? "Edit …" : "Add …"}><XForm key={editing?.id ?? "new"} …/></FormDialog>`, header button becomes plain `openCreate()` (no Close-form toggle).**
- [ ] **Step 3: Run typecheck.**

  Run: `npm run typecheck` in `client/`
  Expected: PASS

- [ ] **Step 4: Manual check desktop + 360px — Add + Edit on all 4 pages opens modal, validation/400 shows, Esc/overlay/Cancel on dirty form discards with no save, success closes + toasts, `?new=1` opens modal on load, focus returns to trigger.**
- [ ] **Step 5: Commit.**

  ```bash
  git add client/src/features/*/components/*Form.tsx client/src/features/*/pages/*.tsx client/src/components/shared/FormDialog.tsx
  git commit -m "feat(client): move create/edit forms into modal"
  ```

### Task 3: Mobile card lists for Transactions + Reports (no scrollbar)

**Files:**
- Modify: `client/src/features/transactions/pages/TransactionsPage.tsx:364-436` (`renderTable`)
- Modify: `client/src/features/reports/pages/ReportsPage.tsx:170-207` (budget-status table)

**Interfaces:**
- Consumes: `Badge`, `Money`, `categoryName` map, `openEdit`, `setDeleting` from owning page
- Produces: same data + same handlers in two renders; no new props

- [ ] **Step 1: Transactions — wrap existing `<Table>` block in `hidden md:block`, add `<div className="grid gap-3 md:hidden">` cards (top row: date + type Badge + amount right; second row: category + description truncate; bottom row: edit/delete `aria-label` kept, `openEdit`/`setDeleting`).**
- [ ] **Step 2: Reports — same dual-render for budget-status (card top: name + status Badge; grid: Limit/Spent/Remaining with `Money`; `is_over` red).**
- [ ] **Step 3: Run typecheck.**

  Run: `npm run typecheck` in `client/`
  Expected: PASS

- [ ] **Step 4: Manual check 360px — no `overflow-x` scrollbar, long names/descriptions truncate/wrap, all columns present, edit/delete work with same `aria-label`s; empty month still shows EmptyState; desktop `md+` still shows tables.**
- [ ] **Step 5: Commit.**

  ```bash
  git add client/src/features/transactions/pages/TransactionsPage.tsx client/src/features/reports/pages/ReportsPage.tsx
  git commit -m "feat(client): mobile card lists for tables"
  ```

### Task 4: Bottom bar — center Transactions FAB + More (Reports/Profile/Notes)

**Files:**
- Modify: `client/src/components/layout/AppShell.tsx:248-282` (`MobileTabBar`)

**Interfaces:**
- Consumes: `ROUTES` from `@/config/routes`, `DropdownMenu` from `@/components/ui/dropdown-menu`, `NAV_ITEMS` icons
- Produces: 5-slot tabbar; More `DropdownMenu` (`side="top"`, `align="end"`) with Reports/Profile/Notes; FAB `NavLink to={ROUTES.transactions}` active on `/transactions`

- [ ] **Step 1: Rebuild `MobileTabBar` to 5 slots — Home (`ROUTES.dashboard`), Categories, center FAB Transactions (`size-14 rounded-full bg-primary -translate-y-4`, `aria-label="Transactions"`), Budgets, More button with `DropdownMenuContent side="top"` holding Reports/Profile/Notes (`NavLink`s, active dot when child route active).**
- [ ] **Step 2: Run typecheck.**

  Run: `npm run typecheck` in `client/`
  Expected: PASS

- [ ] **Step 3: Manual check 360px — 5 items fit, FAB elevated + tappable, More opens upward without clipping, active section indicated, `pb-[env(safe-area-inset-bottom)]` kept, keyboard reachable.**
- [ ] **Step 4: Commit.**

  ```bash
  git add client/src/components/layout/AppShell.tsx
  git commit -m "feat(client): mobile FAB + More navigation"
  ```
