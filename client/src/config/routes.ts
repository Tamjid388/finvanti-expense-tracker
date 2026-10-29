/** Single source of truth for app route paths — used by the router, nav, and links. */
export const ROUTES = {
  login: "/login",
  register: "/register",
  dashboard: "/",
  transactions: "/transactions",
  categories: "/categories",
  notes: "/notes",
  budgets: "/budgets",
  reports: "/reports",
  profile: "/profile",
} as const;
