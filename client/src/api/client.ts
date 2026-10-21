/**
 * HTTP client for the Django REST API (JWT).
 *
 * Contract (client/AGENTS.md + prd.md §12):
 * - Every request carries `Authorization: Bearer <access>`.
 * - On 401: attempt ONE token refresh, retry the original request once; if that
 *   fails, clear the in-memory session and force login. Never loop on 401.
 * - 204 = success with no body. 400 = per-field validation errors.
 */

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

export const api = {
  get: <T>(path: string, params?: QueryParams) => request<T>(path, { method: "GET", params }),
  /** POST normally creates — the API answers 201 with the created resource. */
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  /** DELETE answers 204 (no body) — call as `api.del<void>(…)`. */
  del: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
};

async function request<T>(path: string, options: RequestInit & { isRetry?: boolean }): Promise<T> {
  const { method = "GET", body, params, isRetry = false } = options;
  const headers = new Headers({ Accept: "application/json" });
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Network error — is the API server running?");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (response.status === 401 && !isRetry && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Refresh succeeded — retry the original request exactly once.
      return request<T>(path, { ...options, isRetry: true });
    }
    // Refresh failed: session is dead. Full reload is intentional — the
    // in-memory session is gone, and /login is the only valid screen.
    clearSession();
    redirectToLogin();
    throw new ApiError(401, "Your session expired. Please sign in again.");
  }

  if (!response.ok) {
    const { message, fieldErrors } = await parseError(response);
    throw new ApiError(response.status, message, fieldErrors);
  }

  return (await response.json()) as T;
}

/* ------------------------------- internals -------------------------------- */

// (path always starts with "/api/…" and ends with "/" — DRF trailing-slash discipline)
function buildUrl(path: string, params?: QueryParams): string {
  if (!params) return `${API_BASE_URL}${path}`;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `${API_BASE_URL}${path}?${qs}` : `${API_BASE_URL}${path}`;
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }
  try {
    // Raw fetch on purpose: this must NOT recurse through the 401 handler.
    const response = await fetch(`${API_BASE_URL}/api/auth/token/refresh/`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    if (!response.ok) {
      return false;
    }
    const data = (await response.json()) as TokenRefreshResponse;
    setTokens(data); // rotation returns a NEW refresh token — store the fresh pair
    return true;
  } catch {
    return false;
  }
}

function redirectToLogin(): void {
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`${ROUTES.login}?next=${next}`);
}

async function parseError(
  response: Response,
): Promise<{ message: string; fieldErrors: FieldErrors | null }> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // No body (e.g. bare 429/5xx) — fall through to status copy.
  }

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

  const fallbackByStatus: Record<number, string> = {
    400: "Invalid input.",
    401: "Not authenticated.",
    403: "You are not allowed to do that.",
    404: "Not found.",
    429: "Too many requests — take a moment and try again.",
    500: "Server error — try again later.",
  };
  const generic =
    fallbackByStatus[response.status] ?? `Request failed (HTTP ${response.status}).`;
  return { message: generic, fieldErrors: null };
}

/** DRF field errors: `{ field: ["msg"] }` — show them under the matching inputs. */
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
