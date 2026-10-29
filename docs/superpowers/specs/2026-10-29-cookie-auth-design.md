# Cookie Auth (refresh-in-httpOnly-cookie) — Design (2026-10-29)

## Intent and why
Today a page reload wipes the in-memory JWT pair and forces re-login (`client/src/features/auth/session.ts` documents this as an accepted MVP trade-off). The user rejects that trade-off: a reload must keep them logged in. Of the three options (sessionStorage, localStorage, httpOnly cookies) they picked **httpOnly cookies** — JS can never read the long-lived credential, so XSS can't steal it.

## Goals
- Reload (and tab close/reopen within the refresh lifetime) keeps the user logged in with zero clicks.
- Refresh token never touches JavaScript: httpOnly cookie, scoped to the refresh path.
- Access token stays short-lived (15m) and memory-only, sent as Bearer header exactly as today.
- Rotation + blacklist behavior unchanged (`ROTATE_REFRESH_TOKENS`, `BLACKLIST_AFTER_ROTATION`).
- Existing suites stay green (updating `users/tests.py` where the response shape intentionally changes); `schema.yml` + `schema.d.ts` regenerated.

## Non-goals
- Access-token-in-cookie + custom DRF authentication class (bigger change, new CSRF surface on every mutation) — explicitly not this design.
- "Remember me" toggle — the refresh cookie is persistent (max-age 1d = refresh lifetime), so this is the default; no toggle.
- Session-cookie (tab-close logout) variant — rejected; persistence is the point.
- sessionStorage/localStorage persistence — rejected by user pick.
- Changing access lifetime (15m) or refresh lifetime (1d).

## Anti-goals
- Never expose the refresh token to JS again (no `refresh` in login/refresh JSON bodies once migrated).
- Never send cookies cross-site: keep the CORS origin allowlist, add credentials narrowly (see below).
- No CSRF regression: mutations keep using the Bearer header, never cookies, so the CSRF surface does not grow (rationale documented below).

## Constraints (from repo)
- `server/AGENTS.md`: `JWTAuthentication` only (keep it — cookies carry refresh only, never access); `IsAuthenticated` default; Postgres via `DATABASE_URL`; `transaction.atomic()` on writes; annotations + `schema.yml` in sync.
- `client/AGENTS.md` + `ARCHITECTURE.md`: JWT access in memory; 401 → refresh-once → retry → login; never hand-edit `schema.d.ts` (backend first, then `npm run gen:api`); loading/empty/error states; `python manage.py check` green.
- SimpleJWT behavior to preserve: access 15m / refresh 1d, rotation returns a NEW refresh pair, blacklist after rotation.

## Approaches considered
1. **Persist pair in sessionStorage (recommended earlier):** one-file change, reload-safe, tab-close clears. Rejected by user pick — tokens readable by JS.
2. **Persist pair in localStorage:** survives browser restarts too, but widest XSS theft window. Rejected by user pick.
3. **Refresh-in-httpOnly-cookie + access-in-memory + boot refresh (picked):** login sets a scoped httpOnly refresh cookie and returns `{access}` only; the client keeps access in memory; on boot with no access token it silently calls refresh (cookie auto-sent) then hydrates `/me`. XSS can't steal refresh; CSRF can't read responses; a forged refresh POST at worst rotates a token the attacker never sees. Smallest secure change: no custom auth class, Bearer flow untouched, mutations unaffected.

Picked 3 because it meets the requirement with the narrowest new attack surface and no change to how every existing endpoint authenticates.

## The design (decided)

### Backend (`server/users/`, `server/config/settings.py`)
- **Settings:** `REFRESH_COOKIE_NAME = "refresh_token"`, `REFRESH_COOKIE_MAX_AGE = 86400`, `REFRESH_COOKIE_SECURE = not DEBUG`, `REFRESH_COOKIE_SAMESITE = "Lax"`, `REFRESH_COOKIE_PATH = "/api/auth/"` (covers login, refresh, and logout routes so logout receives and can clear it); `CORS_ALLOW_CREDENTIALS = True` (origin allowlist unchanged).
- **Login** (`EmailTokenObtainPairView` + custom `finalize_response` or overridden `post`): validate as today; on success set the refresh cookie with the attrs above and return body `{access}` only (no `refresh` key). Update `users/tests.py` login assertions accordingly.
- **Refresh:** custom view replacing `TokenRefreshView` at the same route: read refresh from cookie first, fall back to body `refresh` (transition-only read fallback for existing tests/scripts, marked deprecated — never echoed back). On success blacklist old (rotation), set new refresh cookie, return `{access}` only.
- **Logout** (`LogoutView`, keeps `IsAuthenticated`): read refresh from cookie-or-body, blacklist, `delete_cookie` with the same path attrs, 204. Client flow: if access is expired/missing at logout time, silently refresh first, then call logout — so the permission class never blocks a legitimate logout.
- **Deploy topology (assumed, confirm below):** frontend and API are same-site in every env (same host or same-site subdomains), so `SameSite=Lax` cookies are sent on the refresh POST. If any env is cross-origin, this design must change (`SameSite=None; Secure`, tighter origins, or a same-domain proxy) — flagged as the one open question.
- **Known limitation (accepted):** with rotation + blacklist, two tabs booting at once can race — loser gets 401 and re-logs in. Same outcome as any expiry today; no reuse-tolerance sequencing in this design.
- **CSRF rationale (record in code comment):** no session authentication is used, so Django CSRF checks don't apply; `SameSite=Lax` + path-scoped cookie + CORS allowlist contain forged refresh POSTs, whose only effect is rotating a token into an httpOnly cookie the attacker can't read. Mutations authenticate via Bearer header, unchanged.
- **Schema:** annotate cookie usage with `extend_schema` (auth responses `{access}`), regenerate `server/schema.yml`.

### Frontend (`client/src/api/`, `client/src/features/auth/`)
- **Transport:** axios sends cookies — set `withCredentials: true` on the shared instance (or at minimum on login/refresh/logout calls; builder picks global for simplicity and documents it). CORS preflight stays same-origin-allowlisted.
- **`session.ts`:** stores access token only (drop refresh persistence; keep function names where cheap — builder may narrow `TokenPair` to `{access: string}` and update imports; exact type edits are builder's call).
- **Refresh:** `refreshAccessToken()` POSTs `{}` (no body) to `/api/auth/token/refresh/` with credentials; on 200 stores the returned access. Remove the `getRefreshToken()` gate so a boot-time 401 with no memory tokens still attempts one cookie refresh (existing retry flag prevents loops; one wasted refresh POST for genuinely logged-out users is accepted).
- **Boot:** `ProtectedRoute` (or a new `useBootSession()` in `features/auth/`, builder's call) does: if no access token → silent refresh → on success fetch `me` and render, else redirect `/login`; show `LoadingState` while attempting. Existing 401 interceptor behavior otherwise unchanged.
- **`api/auth.ts`:** `login` returns `{access}`; `logout` POSTs `{}`; `me` unchanged. Regenerate `schema.d.ts` via `npm run gen:api` and update `types/api.ts` (`TokenPair` → access-only shape; `LoginResponse`/`TokenRefreshResponse` follow the new schemas).
- **Verify:** `npm run typecheck`, `npm run build`, live smoke: login → reload → still on Notes (no login redirect); refresh-token cookie present with HttpOnly flag; logout → cookie gone → reload lands on `/login`.

## What's left to the builder
- Exact code shape of the custom refresh view and cookie-setting helper (one helper used by login/refresh/logout).
- Whether `TokenPair` is narrowed or replaced, and whether `withCredentials` is global or per-call.
- Where boot refresh lives (`ProtectedRoute` vs new hook) — must show loading state, never flash login.
- Updating `users/tests.py` (login/refresh/logout cookie + body assertions) and adding: reload-simulation test (client without memory tokens refreshes via cookie), logout-clears-cookie test, wrong-cookie 401 test.
- Migration note: none needed (no model changes); deployment note: `Secure` cookies require HTTPS in prod (already a repo requirement).
