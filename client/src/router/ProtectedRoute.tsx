import type { ReactNode } from "react";

import { Navigate, useLocation } from "react-router";

import { ROUTES } from "@/config/routes";
import { getAccessToken } from "@/features/auth/session";

/**
 * Route guard: renders children only while a session token exists (in-memory,
 * per client/AGENTS.md). Session changes always coincide with router
 * navigations (login success / logout), so a plain read is sufficient here.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();

  if (getAccessToken() === null) {
    // `state.from` lets the login page bounce back after a successful sign-in.
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
