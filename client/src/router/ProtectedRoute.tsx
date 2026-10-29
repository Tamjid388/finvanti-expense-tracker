import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Navigate, useLocation } from "react-router";

import { authApi } from "@/api/auth";
import { LoadingState } from "@/components/shared/LoadingState";
import { ROUTES } from "@/config/routes";
import { getAccessToken } from "@/features/auth/session";

/**
 * Route guard: renders children while a session exists. On reload the
 * in-memory access token is gone, so boot silently refreshes via the
 * httpOnly cookie once (single-flight) before deciding.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<"checking" | "authed" | "guest">(() =>
    getAccessToken() !== null ? "authed" : "checking",
  );

  useEffect(() => {
    if (getAccessToken() !== null) {
      setStatus("authed");
      return;
    }
    let cancelled = false;
    void authApi.refreshSession().then((ok) => {
      if (!cancelled) {
        setStatus(ok && getAccessToken() !== null ? "authed" : "guest");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "checking") {
    return <LoadingState label="Restoring session…" />;
  }
  if (status === "guest") {
    // `state.from` lets the login page bounce back after a successful sign-in.
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
