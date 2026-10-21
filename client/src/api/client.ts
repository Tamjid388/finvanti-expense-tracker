/** HTTP client for the Django REST API (JWT) — axios edition. */
import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

import { API_BASE_URL } from "@/config/env";
import { ROUTES } from "@/config/routes";
import { clearSession, getAccessToken, getRefreshToken, setTokens } from "@/features/auth/session";
import type { FieldErrors, TokenRefreshResponse } from "@/types/api";

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldErrors | null;

  constructor(status: number, message: string, fieldErrors: FieldErrors | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export type RequestInit = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  params?: QueryParams;
};

/** Raw axios instance — prefer the typed `api` wrapper below for backend calls. */
export const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: "application/json" },
  timeout: 15_000,
});

const REFRESH_PATH = "/api/auth/token/refresh/";
const RETRY_FLAG = "__isRetry";

/** Single-flight refresh: parallel 401s share one refresh POST. */
let refreshPromise: Promise<boolean> | null = null;

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // The refresh call authenticates with the refresh token in the body — no Bearer.
  const isRefreshCall = typeof config.url === "string" && config.url.includes(REFRESH_PATH);
  if (!isRefreshCall) {
    const accessToken = getAccessToken();
    if (accessToken) {
      config.headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { [RETRY_FLAG]?: boolean }) | undefined;
    const status = error.response?.status;
    const isRefreshCall =
      typeof config?.url === "string" && config.url.includes(REFRESH_PATH);

    if (status === 401 && config && !config[RETRY_FLAG] && !isRefreshCall && getRefreshToken()) {
      config[RETRY_FLAG] = true;
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return http.request(config);
      }
      // Refresh failed: session is dead. Full reload is intentional — the
      // in-memory session is gone, and /login is the only valid screen.
      clearSession();
      redirectToLogin();
    }
    return Promise.reject(error);
  },
);

export const api = {
  get: <T>(path: string, params?: QueryParams) => request<T>(path, { method: "GET", params }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  del: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
};

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const { method = "GET", body, params } = options;
  try {
    const response = await http.request<T>({
      url: path,
      method,
      params: cleanParams(params),
      // axios sets Content-Type for objects; set it only when a body is present.
      ...(body === undefined
        ? {}
        : { data: body, headers: { "Content-Type": "application/json" } }),
    });
    // 204 normalizes to empty data.
    if (response.status === 204) {
      return undefined as T;
    }
    // Void callers (delete) may get 200 + null.
    if (response.data === undefined || response.data === null || response.data === "") {
      return undefined as T;
    }
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

/* --------------------------------- internals --------------------------------- */

// DRF trailing-slash discipline: paths start with "/api/…" and end with "/".
function cleanParams(params?: QueryParams): QueryParams | undefined {
  if (!params) return undefined;
  const out: QueryParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      out[key] = value;
    }
  }
  return out;
}

function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return Promise.resolve(false);
    }
    // Flagged so the interceptor never refreshes-the-refresh on a 401 here.
    refreshPromise = http
      .post<TokenRefreshResponse>(
        REFRESH_PATH,
        { refresh: refreshToken },
        {
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          // Reuse the retry flag slot so the interceptor skips this call.
          [RETRY_FLAG]: true,
        } as Record<string, unknown>,
      )
      .then((response) => {
        // Rotation returns a NEW refresh token — store the fresh pair.
        setTokens(response.data);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function redirectToLogin(): void {
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`${ROUTES.login}?next=${next}`);
}

function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === undefined) {
      return new ApiError(0, "Couldn't reach the server. Check your connection and try again.");
    }
    // Interceptor already cleared the session + redirected; surface a message
    // so TanStack Query hooks render the right state.
    if (status === 401) {
      const { message } = parseErrorPayload(error.response?.data, status);
      return new ApiError(401, message, null);
    }
    const { message, fieldErrors } = parseErrorPayload(error.response?.data, status);
    return new ApiError(status, message, fieldErrors);
  }
  return new ApiError(0, "Couldn't reach the server. Check your connection and try again.");
}

function parseErrorPayload(
  payload: unknown,
  status: number,
): { message: string; fieldErrors: FieldErrors | null } {
  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    const detail = typeof record.detail === "string" ? record.detail : undefined;
    const fieldErrors = extractFieldErrors(record);
    if (fieldErrors) {
      return {
        message: detail ?? "Please fix the highlighted fields.",
        fieldErrors,
      };
    }
    if (detail) {
      return { message: detail, fieldErrors: null };
    }
  }

  if (typeof payload === "string" && payload.length > 0) {
    return { message: payload, fieldErrors: null };
  }

  const fallbackByStatus: Record<number, string> = {
    400: "Invalid input.",
    401: "Not authenticated.",
    403: "You are not allowed to do that.",
    404: "Not found.",
    429: "Too many requests — take a moment and try again.",
    500: "Server error — try again later.",
  };
  const generic = fallbackByStatus[status] ?? `Request failed (HTTP ${status}).`;
  return { message: generic, fieldErrors: null };
}

/** DRF field errors: `{ field: ["msg"] }`. */
function extractFieldErrors(payload: Record<string, unknown>): FieldErrors | null {
  const out: FieldErrors = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key === "detail") continue;
    if (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string")) {
      out[key] = (value as string[]).join(" ");
    } else if (typeof value === "string") {
      out[key] = value;
    }
  }
  return Object.keys(out).length === 0 ? null : out;
}
