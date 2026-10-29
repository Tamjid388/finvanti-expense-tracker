# Cookie Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep users logged in across page reloads by moving the refresh token into a scoped httpOnly cookie while the access token stays memory-only.

**Architecture:** Backend sets/reads/clears a path-scoped httpOnly refresh cookie (`/api/auth/`) and returns `{access}`-only JSON; frontend sends cookies via `withCredentials`, keeps access in memory, and silently refreshes on boot when no access token exists. No custom DRF auth class; Bearer flow for all existing endpoints is untouched.

**Tech Stack:** Python 3.13, Django 6.1.2, DRF 3.18.3, Simple JWT 5.5.1 (rotation + blacklist), drf-spectacular 0.30.0; React 19 + Vite + TypeScript strict, TanStack Query v5, axios 1.20.

**Spec:** `docs/superpowers/specs/2026-10-29-cookie-auth-design.md`

## Global Constraints

- Auth: `JWTAuthentication` only (cookies carry refresh only, never access); `IsAuthenticated` default; access 15m / refresh 1d with `ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION`.
- Cookie: name `refresh_token`, HttpOnly, `Secure = not DEBUG`, `SameSite = "Lax"`, `Path = "/api/auth/"`, `Max-Age = 86400`.
- Bodies return `{access}` only — no `refresh` key in login/refresh JSON (read-only body fallback on refresh/logout during transition, marked deprecated, never echoed).
- Logout keeps `IsAuthenticated`; client refreshes first when access is missing so logout never dead-ends.
- CORS: origin allowlist unchanged, add `CORS_ALLOW_CREDENTIALS = True`.
- Client: access token memory-only; 401 → single cookie refresh → retry → login; never hand-edit `src/api/schema.d.ts` (backend first, then `npm run gen:api`); `python manage.py check` green.
- Local dev host rule: open frontend at `http://127.0.0.1:5173` to match `VITE_API_BASE_URL=http://127.0.0.1:8000` (`localhost` vs `127.0.0.1` are different sites; `Lax` cookies won't be sent cross-site).

## Review Focus

- Expired/tampered refresh cookie on refresh returns 401 and the client lands on `/login` (no loop, no crash) — pinned by Task 2 test `test_refresh_bad_cookie_401_then_login_shape`.
- Logout with expired access but valid cookie still blacklists + clears the cookie (client refreshes first) — pinned by Task 2 test `test_logout_after_access_expiry_succeeds`.
- Anonymous refresh (no cookie at all) returns 401 with a stable error shape, no 500 — pinned by Task 2 test `test_refresh_no_cookie_401`.
- Host mismatch (`localhost` page vs `127.0.0.1` API) silently drops the cookie so boot refresh fails to login — pinned by Task 4 live-smoke step asserting the host rule explicitly.
- Two tabs booting at once can race rotation (loser re-logs in; accepted limitation, same as expiry today) — no test; documented in spec.

---

### Task 1: Backend cookie settings + login/refresh/logout views

**Files:**
- Modify: `server/config/settings.py` — add `REFRESH_COOKIE_*` constants + `CORS_ALLOW_CREDENTIALS = True`
- Create: `server/users/cookies.py` — `set_refresh_cookie(response, token: str) -> None`, `clear_refresh_cookie(response) -> None` (single helper pair used by all three views)
- Modify: `server/users/views.py` — login sets cookie + returns `{access}`; custom `CookieTokenRefreshView` (cookie-first, body fallback deprecated); `LogoutView` cookie-or-body + `delete_cookie`
- Modify: `server/users/urls.py` — route `token/refresh/` to `CookieTokenRefreshView` instead of `TokenRefreshView`
- Test: `python manage.py check` + regenerate `server/schema.yml` (`python manage.py spectacular --file schema.yml`)

**Interfaces:**
- Consumes: `EmailTokenObtainPairSerializer` (unchanged validation), `RefreshToken` blacklist/rotation, SimpleJWT `api_settings`.
- Produces: `users.cookies.set_refresh_cookie/clear_refresh_cookie`; login response body `{access: str}` + `Set-Cookie: refresh_token=...; HttpOnly; Path=/api/auth/; SameSite=Lax; Max-Age=86400`; refresh request reads `request.COOKIES["refresh_token"]` then body `refresh`; logout clears cookie + 204.

- [ ] **Step 1: Write the failing test**

```python
def test_login_sets_http_only_cookie_and_access_only_body(self):
    res = self.client.post("/api/auth/login/", {"email": "me@example.com", "password": "StrongPass123"})
    self.assertEqual(res.status_code, 200)
    self.assertIn("access", res.data)
    self.assertNotIn("refresh", res.data)
    self.assertIn("refresh_token", res.cookies)
    self.assertTrue(res.cookies["refresh_token"]["httponly"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python manage.py test users -v 1 --keepdb` (from `server/` with `DATABASE_URL` set)
Expected: FAIL — `refresh` still in body, no cookie set.

- [ ] **Step 3: Implement `users/cookies.py` + settings constants in `server/config/settings.py`**

Constants: `REFRESH_COOKIE_NAME = "refresh_token"`, `REFRESH_COOKIE_MAX_AGE = 86400`, `REFRESH_COOKIE_SECURE = not DEBUG`, `REFRESH_COOKIE_SAMESITE = "Lax"`, `REFRESH_COOKIE_PATH = "/api/auth/"`; add `CORS_ALLOW_CREDENTIALS = True` next to `CORS_ALLOWED_ORIGINS`. Helpers use `django.conf.settings` values, nothing hardcoded.

- [ ] **Step 4: Implement login cookie + `CookieTokenRefreshView` + `LogoutView` changes in `server/users/views.py`, rewire `server/users/urls.py`**

Login: after serializer validation, `set_refresh_cookie(response, str(refresh))`, body `{"access": str(access)}`. Refresh view: `refresh = request.COOKIES.get(NAME) or (request.data.get("refresh") if body else None)`; missing → 401; `RefreshToken(refresh)` → blacklist/rotation via SimpleJWT; set new cookie; return `{"access": ...}` only. Logout: same cookie-or-body read; missing → 400 (unchanged shape); blacklist; `clear_refresh_cookie(response)`; 204. Keep `IsAuthenticated` on logout. `extend_schema` summaries updated for cookie behavior. CSRF rationale recorded as a code comment (no session auth; Lax + path scope + CORS allowlist).

- [ ] **Step 5: Regenerate schema and run check**

Run: `python manage.py spectacular --file schema.yml` then `python manage.py check`
Expected: `git diff schema.yml` shows `/api/auth/*` cookie response changes only; check clean.

- [ ] **Step 6: Commit**

```bash
git add server/config/settings.py server/users/cookies.py server/users/views.py server/users/urls.py server/schema.yml
git commit -m "feat(auth): issue refresh token via scoped httpOnly cookie"
```

### Task 2: Backend auth tests (update + new cookie coverage)

**Files:**
- Modify: `server/users/tests.py`
- Test: `server/users/tests.py`

**Interfaces:**
- Consumes: Task 1 views/cookies (login `{access}` + cookie; refresh cookie-first; logout clears cookie).
- Produces: green `users` suite pinning cookie behavior, rotation, and all Review Focus backend lines.

- [ ] **Step 1: Write the failing tests**

```python
def test_refresh_bad_cookie_401_then_login_shape(self):
    self.client.cookies.load({"refresh_token": "bogus"})
    res = self.client.post("/api/auth/token/refresh/", {}, format="json")
    self.assertEqual(res.status_code, 401)

def test_logout_after_access_expiry_succeeds(self):
    # valid cookie, no Authorization header -> refresh first, then logout
    res = self.client.post("/api/auth/token/refresh/", {}, format="json")
    self.assertEqual(res.status_code, 200)
    self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    out = self.client.post("/api/auth/logout/", {}, format="json")
    self.assertEqual(out.status_code, 204)
    self.assertEqual(out.cookies["refresh_token"].value, "")

def test_refresh_no_cookie_401(self):
    res = self.client.post("/api/auth/token/refresh/", {}, format="json")
    self.assertEqual(res.status_code, 401)
```

Plus updates: setup reads access from `res.data["access"]` and relies on the test-client cookie jar (no `res.data["refresh"]`); `test_login_with_email_success` asserts cookie flags; `test_logout_blacklists_refresh` uses cookie jar + asserts replay 401; logout missing/invalid cases cover cookie-absent and bogus-cookie 400s.

- [ ] **Step 2: Run tests to verify failures**

Run: `python manage.py test users -v 2 --keepdb`
Expected: FAIL on updated assertions until Task 1 behavior is complete (if Task 1 done: new tests pass, old ones fail until updated — either way RED first).

- [ ] **Step 3: Update `server/users/tests.py` to the cookie flow (no expectation weakening — assert the new contract)**

Keep all 12 original scenarios, translated: login asserts `{access}`-only + cookie flags; refresh tests use the cookie jar; logout tests assert blacklist + cleared cookie.

- [ ] **Step 4: Run full backend suite**

Run: `python manage.py test --keepdb -v 1` (from `server/`)
Expected: all PASS (users + categories + transactions + budgets + reports + notes).

- [ ] **Step 5: Commit**

```bash
git add server/users/tests.py
git commit -m "test(auth): cover httpOnly refresh cookie flow"
```

### Task 3: Client transport + session + auth API + types

**Files:**
- Modify: `client/src/api/client.ts` — `withCredentials: true` on the shared axios instance; `refreshAccessToken()` POSTs `{}` (no body), stores returned access; drop the `getRefreshToken()` gate (attempt refresh on any non-retried 401 outside the refresh call itself)
- Modify: `client/src/features/auth/session.ts` — access-only storage (narrow `TokenPair` to `{access: string}`, update `setTokens` callers)
- Modify: `client/src/api/auth.ts` — `login` returns `{access}`; `logout` POSTs `{}` (cookie cleared server-side)
- Modify: `client/src/types/api.ts` — `TokenPair`/`LoginResponse`/`TokenRefreshResponse` follow regenerated schemas
- Modify (generated): `client/src/api/schema.d.ts` via `npm run gen:api` (never hand-edit)
- Test: `npm run typecheck` (from `client/`)

**Interfaces:**
- Consumes: Task 1 API (`{access}` bodies, cookie-set endpoints); regenerated `schema.d.ts` (`Note`/`PatchedNote` unaffected, auth schemas access-only).
- Produces: cookie-sending axios instance; access-only `session.ts`; `authApi.login/logout/me` with new shapes; `useLogin`/`useLogout`/`useMe` keep their signatures (no page changes needed).

- [ ] **Step 1: Regenerate types and confirm access-only auth schemas**

Run: `npm run gen:api` (from `client/`)
Expected: `Login`/`TokenRefresh` schemas contain `access` and no `refresh`; PASS.

- [ ] **Step 2: Implement `client.ts` + `session.ts` + `auth.ts` + `types/api.ts` changes**

`http` gets `withCredentials: true`; `refreshAccessToken` posts `REFRESH_PATH` with `{}` and `setTokens({access})`; `logout` posts `{}`; `TokenPair = {access: string}` (update `setTokens`/`getRefreshToken` usages — remove refresh getter or keep returning null; document choice in code).

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS with no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/api/client.ts client/src/features/auth/session.ts client/src/api/auth.ts client/src/types/api.ts client/src/api/schema.d.ts
git commit -m "feat(auth): drive refresh via httpOnly cookie"
```

### Task 4: Boot refresh in ProtectedRoute + end-to-end verification

**Files:**
- Modify: `client/src/router/ProtectedRoute.tsx` — silent cookie refresh when no access token, `LoadingState` while attempting, redirect `/login` only after refresh fails
- Modify: `client/src/features/notes/pages/NotesPage.tsx` — none expected (regression surface only)
- Test: `npm run build` + live smoke (below)

**Interfaces:**
- Consumes: Task 3 transport/session (`refreshAccessToken`, `authApi.me`, `getAccessToken`).
- Produces: reload-proof route guard; verified login → reload → still logged in → logout → login flows.

- [ ] **Step 1: Implement boot refresh in `ProtectedRoute.tsx`**

On mount with no access token: call refresh once; success → fetch `me` (prime `qk.me()` cache via `useMe`-compatible query or direct `authApi.me()` + `setUser`) and render children; failure → `<Navigate to={ROUTES.login}>` preserving `state.from`. While attempting, render `LoadingState`. Never flash the login page on a valid cookie.

- [ ] **Step 2: Verify build**

Run: `npm run build` (from `client/`)
Expected: `tsc -b` + `vite build` succeed.

- [ ] **Step 3: Live smoke (host rule observed: frontend at `http://127.0.0.1:5173`, API at `http://127.0.0.1:8000`)**

Run backend `runserver` + `npm run dev`; login → assert `refresh_token` cookie has HttpOnly flag → reload page → still on target page (no login redirect) → logout → cookie gone → reload lands on `/login` → wrong-cookie state returns 401 shape. Report each step's result.
Expected: all green; host-mismatch case documented if hit.

- [ ] **Step 4: Commit**

```bash
git add client/src/router/ProtectedRoute.tsx
git commit -m "feat(auth): silent cookie refresh on boot"
```
