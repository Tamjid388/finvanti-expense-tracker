/**
 * Base URL of the Django REST server (server/), no trailing slash.
 *
 * Local dev (`vite dev`) always uses a relative base: vite proxies `/api`
 * to the Django server (see vite.config.ts), so page and API are same-origin
 * and auth cookies work from any local hostname. Production builds use
 * VITE_API_BASE_URL (missing env falls back to the documented default).
 */
const API_BASE_URL = import.meta.env.DEV
  ? ""
  : (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000");

export { API_BASE_URL };
