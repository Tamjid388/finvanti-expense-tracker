import { api } from "@/api/client";
import { setTokens } from "@/features/auth/session";
import type {
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
  TokenRefreshResponse,
  User,
} from "@/types/api";

const BASE = "/api/auth";

/** Single-flight boot refresh (StrictMode double-invokes effects — one POST only). */
let bootRefresh: Promise<boolean> | null = null;

export const authApi = {
  register: (payload: RegisterPayload) => api.post<RegisterResponse>(`${BASE}/register/`, payload),
  login: (payload: LoginPayload) => api.post<LoginResponse>(`${BASE}/login/`, payload),
  // Refresh cookie is cleared server-side; nothing secret to send.
  logout: () => api.post<void>(`${BASE}/logout/`, {}),
  me: () => api.get<User>(`${BASE}/me/`),
  refreshSession: (): Promise<boolean> => {
    if (!bootRefresh) {
      bootRefresh = api
        .post<TokenRefreshResponse>(`${BASE}/token/refresh/`, {})
        .then((res) => {
          setTokens({ access: res.access });
          return true;
        })
        .catch(() => false)
        .finally(() => {
          bootRefresh = null;
        });
    }
    return bootRefresh;
  },
};
