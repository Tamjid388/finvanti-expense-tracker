import { api } from "@/api/client";
import type { LoginPayload, LoginResponse, RegisterPayload, User } from "@/types/api";

const BASE = "/api/auth";

/**
 * Auth endpoints. Login/register payloads + shapes mirror `server/schema.yml`
 * (EmailTokenObtainPair/Register); `/me/` is the client-AGENTS.md contract.
 */
export const authApi = {
  /** POST /api/auth/register/ → 201 + user. */
  register: (payload: RegisterPayload) => api.post<User>(`${BASE}/register/`, payload),

  /** POST /api/auth/login/ → token pair (access 15m, refresh 1d, rotated). */
  login: (payload: LoginPayload) => api.post<LoginResponse>(`${BASE}/login/`, payload),

  /** POST /api/auth/logout/ → blacklists the refresh token server-side. */
  logout: () => api.post<void>(`${BASE}/logout/`, {}),

  /** GET /api/auth/me/ → the access token's user. */
  me: () => api.get<User>(`${BASE}/me/`),
};
