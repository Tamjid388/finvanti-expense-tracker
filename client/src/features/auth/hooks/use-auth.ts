import { useLocation, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authApi } from "@/api/auth";
import { qk } from "@/api/query-keys";
import { ROUTES } from "@/config/routes";
import { clearSession, setUser, setTokens } from "../session";
import type { LoginPayload, RegisterPayload } from "@/types/api";

/** Hydrates the shell/profile with the access-token user (cached under qk.me). */
export function useMe() {
  return useQuery({
    queryKey: qk.me(),
    queryFn: async () => {
      const user = await authApi.me();
      setUser(user);
      return user;
    },
  });
}

/**
 * Login → store tokens → bounce back to where the guard intercepted the user.
 * Wires up as soon as the Django server is running (see LoginPage).
 */
export function useLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const tokens = await authApi.login(payload);
      setTokens(tokens);
    },
    onSuccess: () => {
      // ProtectedRoute stores `state.from` when redirecting to /login.
      const from = (location.state as { from?: { pathname?: string } } | null)?.from;
      const target =
        from?.pathname && from.pathname !== ROUTES.login ? from.pathname : ROUTES.dashboard;
      navigate(target, { replace: true });
    },
  });
}

/** Register → hand the user to /login; tokens are only issued there. */
export function useRegister() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: () => navigate(ROUTES.login, { replace: true }),
  });
}

/** Logout → API blacklist → clear in-memory session + query cache → /login. */
export function useLogout() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      clearSession();
      qc.clear();
      navigate(ROUTES.login, { replace: true });
    },
  });
}
