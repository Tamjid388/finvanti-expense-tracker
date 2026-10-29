import { Suspense, lazy } from "react";
import type { ReactNode } from "react";

import { createBrowserRouter } from "react-router";

import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/shared/LoadingState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { ROUTES } from "@/config/routes";

import { ProtectedRoute } from "./ProtectedRoute";

/**
 * Feature pages are lazy code-chunks. They are loaded through each feature's
 * public barrel (ARCHITECTURE.md §4.1) while defining which lazy modules to use.
 */
const DashboardPage = lazy(() =>
  import("@/features/dashboard").then(({ DashboardPage }) => ({ default: DashboardPage })),
);
const TransactionsPage = lazy(() =>
  import("@/features/transactions").then(({ TransactionsPage }) => ({ default: TransactionsPage })),
);
const CategoriesPage = lazy(() =>
  import("@/features/categories").then(({ CategoriesPage }) => ({ default: CategoriesPage })),
);
const NotesPage = lazy(() =>
  import("@/features/notes").then(({ NotesPage }) => ({ default: NotesPage })),
);
const BudgetsPage = lazy(() =>
  import("@/features/budgets").then(({ BudgetsPage }) => ({ default: BudgetsPage })),
);
const ReportsPage = lazy(() =>
  import("@/features/reports").then(({ ReportsPage }) => ({ default: ReportsPage })),
);
const ProfilePage = lazy(() =>
  import("@/features/profile").then(({ ProfilePage }) => ({ default: ProfilePage })),
);
const LoginPage = lazy(() =>
  import("@/features/auth").then(({ LoginPage }) => ({ default: LoginPage })),
);
const RegisterPage = lazy(() =>
  import("@/features/auth").then(({ RegisterPage }) => ({ default: RegisterPage })),
);

function withSuspense(children: ReactNode): ReactNode {
  return <Suspense fallback={<LoadingState label="Loading screen…" />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: ROUTES.dashboard,
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: withSuspense(<DashboardPage />) },
      { path: "transactions", element: withSuspense(<TransactionsPage />) },
      { path: "categories", element: withSuspense(<CategoriesPage />) },
      { path: "notes", element: withSuspense(<NotesPage />) },
      { path: "budgets", element: withSuspense(<BudgetsPage />) },
      { path: "reports", element: withSuspense(<ReportsPage />) },
      { path: "profile", element: withSuspense(<ProfilePage />) },
    ],
  },
  { path: ROUTES.login, element: withSuspense(<LoginPage />) },
  { path: ROUTES.register, element: withSuspense(<RegisterPage />) },
  { path: "*", element: <NotFoundState /> },
]);
