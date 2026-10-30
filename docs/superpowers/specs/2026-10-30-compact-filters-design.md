# Compact transaction filters + remove navbar Add button — design (Option A approved)

Date: 2026-10-30
Status: draft — awaiting human approval (do not build yet)

## Intent and why

The Transactions filter card stacks type switch, category dropdown, two date
inputs, and Reset full-width — on a 360px phone it's a tall wall of controls
before any transaction is visible. User wants the same filters, always
visible, but compact (one or two tidy rows). Separately, the navbar Add
transaction button should go; on phones it's the only thing left in the
topbar, so the whole mobile topbar goes with it.

## Goals

- Filter card keeps all four controls (type, category, start/end dates,
  Reset) visible at all times, packed into a compact layout that reads in
  one or two rows on phones.
- Remove the Add transaction button from `Topbar`; hide the entire topbar
  header on mobile (`hidden md:block`), keep desktop search unchanged.
- Page header and empty-state Add buttons keep opening the create dialog;
  `?new=1` deep link keeps working (dialog lives on the page).

## Non-goals

- No change to filter logic, defaults (current-month bounds), pagination,
  `?new=1` trigger, or dialog behavior.
- No date presets, no collapsible/hidden filters, no desktop layout change
  beyond removing the navbar button.

## Anti-goals

- Hiding any filter behind a toggle or removing one to save space.
- An empty topbar strip left on mobile, or losing desktop search.

## Constraints

- React 19 + Tailwind v4 mobile-first, shadcn/radix, `cn()`; PRD §10 a11y
  (labeled inputs, keyboard reachable, understandable errors).
- Filters must keep working exactly as today: changing any control resets
  to page 1; invalid category for the selected type falls back to All;
  range error text stays.
- No new deps; verify with `npm run typecheck`.

## Approaches

- **A — same controls, tightened grid (chosen):** type switch on its own
  compact row, category + dates in a tight grid with smaller inputs, Reset
  as icon-only button. Pure layout, zero behavior change.
- **B — date preset chips (rejected):** This month / Last 30 days / Custom.
  Nicer to tap but adds new state and date math; user picked A.

Why A: it delivers "compact but complete" with the smallest diff and no
behavior risk.

## What they decided

- A for the filter card; filters stay always visible.
- Topbar button removed; mobile topbar hidden entirely; desktop search kept.

## What's left to the builder

- Exact grid classes and input sizing (e.g. `grid-cols-2` mobile rows,
  `size="sm"` inputs, icon-only Reset with `aria-label`/`title` kept).
- Plan + tests via `/writing-plans` after this doc is approved. Verify with
  `npm run typecheck` and a 360px + desktop check.
