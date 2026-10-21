import { api } from "@/api/client";
import { getRefreshToken } from "@/features/auth/session";
import type {
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
  User,
} from "@/types/api";

const BASE = "/api/auth";

export const authApi = {
  register: (payload: RegisterPayload) => api.post<RegisterResponse>(`${BASE}/register/`, payload),
  login: (payload: LoginPayload) => api.post<LoginResponse>(`${BASE}/login/`, payload),
  logout: () => {
    const refresh = getRefreshToken();
    return api.post<void>(`${BASE}/logout/`, refresh ? { refresh } : {});
  },
  me: () => api.get<User>(`${BASE}/me/`),
};
