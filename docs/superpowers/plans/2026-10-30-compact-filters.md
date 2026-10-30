# Compact Transaction Filters + Remove Navbar Add Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the navbar Add button (hiding the emptied mobile topbar) and pack the Transactions filter card into a compact always-visible layout.

**Architecture:** Two independent single-file edits: `Topbar` in `AppShell.tsx` loses its quick-add button and the header hides below `md`; the filter `Card` in `TransactionsPage.tsx` keeps its four controls with identical ids/handlers and only its layout classes change.

**Tech Stack:** React 19.3 + Vite 8.3 + TypeScript 7.0 strict, Tailwind CSS v4 mobile-first, shadcn/radix (`radix-ui@1.8.1`, `cn`), React Router 8.5

**Spec:** `docs/superpowers/specs/2026-10-30-compact-filters-design.md`

## Global Constraints

- Mobile-first Tailwind; no new runtime deps.
- Filter logic untouched: same controls, same ids (`f-category`, `f-start`, `f-end`), same handlers, page-1 reset on change, category-falls-back-to-All, range-error text stays.
- `?new=1` trigger unchanged; page header and empty-state Add buttons keep opening the dialog.
- A11y (PRD §10): labeled inputs, keyboard reachable, icon-only Reset keeps an accessible name.
- Never hand-edit `src/api/schema.d.ts`; verify with `npm run typecheck` in `client/`.

## Review Focus

- 320px phone with a long category name — select and grid must not overflow or push Reset off-screen; names truncate.
- Keyboard-only filter use — tab order reaches type switch, category, both dates, Reset; icon-only Reset is focusable with a name.
- Screen reader on Reset — icon-only button still announces "Reset filters".
- Mobile native date inputs — both date fields stay tappable with usable touch targets in the tight grid.
- Desktop regression — filter row still lays out in one comfortable line group at `md+` with no visual breakage.

---

### Task 1: Remove navbar Add button, hide mobile topbar

**Files:**
- Modify: `client/src/components/layout/AppShell.tsx:208-242` (`Topbar`)
- Test: manual + `npm run typecheck` (no runner per `client/AGENTS.md`)

**Interfaces:**
- Consumes: nothing from other tasks
- Produces: `Topbar` renders search form (desktop) + avatar only; header hidden below `md`

- [ ] **Step 1: Delete the `Button size="lg" asChild` quick-add block from `Topbar`, add `hidden md:block` to the header element, and remove the now-unused `Plus` import (verify `Link` is still used elsewhere in the file before touching its import).**

- [ ] **Step 2: Run typecheck to verify it compiles.**

  Run: `npm run typecheck` in `client/`
  Expected: PASS (exit 0)

- [ ] **Step 3: Manual check — desktop shows search + avatar, no Add button; 360px shows no topbar strip (dark site bar flows straight into page); `?new=1` still opens the dialog; page header and empty-state Add buttons still work.**

- [ ] **Step 4: Commit.**

  ```bash
  git add client/src/components/layout/AppShell.tsx
  git commit -m "feat(client): remove navbar Add button, hide mobile topbar"
  ```

### Task 2: Compact the Transactions filter card

**Files:**
- Modify: `client/src/features/transactions/pages/TransactionsPage.tsx:212-299` (filter `Card`)
- Test: manual + `npm run typecheck` (no runner per `client/AGENTS.md`)

**Interfaces:**
- Consumes: nothing from other tasks (independent of Task 1)
- Produces: same four controls with same ids/handlers in a compact grid; icon-only Reset

- [ ] **Step 1: Re-lay the filter `CardContent` with no logic changes: type `TypeSegmented` on its own compact row; category `Select` (`id="f-category"`, `w-48` → flexible `min-w-0 flex-1`), start/end date `Input`s (`id="f-start"`/`f-end`), and Reset in a tight `grid grid-cols-2 gap-2` (dates side by side, Reset icon-only `size="icon"` with `aria-label="Reset filters"`, keeping `title="Clear all filters"` and the same `onClick={resetFilters}`); keep all `Label`s, ids, values, `onChange` handlers, range-error and searching notes exactly as-is.**

- [ ] **Step 2: Run typecheck to verify it compiles.**

  Run: `npm run typecheck` in `client/`
  Expected: PASS (exit 0)

- [ ] **Step 3: Manual check 360px and 320px — filters fit in compact rows with no overflow, long category names truncate, both date fields tappable, Reset reachable by touch and keyboard and announced; desktop `md+` row intact; changing any control still resets to page 1 and invalid category still falls back to All.**

- [ ] **Step 4: Commit.**

  ```bash
  git add client/src/features/transactions/pages/TransactionsPage.tsx
  git commit -m "feat(client): compact transaction filters for mobile"
  ```
