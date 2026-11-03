# Google Sign-In (ID-token flow) — Design (2026-10-30)

## Intent and why
Add "Continue with Google" alongside email + password so users can sign in faster, while keeping the existing JWT + httpOnly refresh-cookie auth exactly as-is. The user picked approach A (ID-token flow) and the linking policy: an existing password-only email must sign in with password first, then link — Google must never take over a password account on its own.

## Goals
- "Continue with Google" button on Login (and Register entry point reuses Login flow) via Google Identity Services.
- New Google email with no existing account auto-creates a user (derived username, unusable password).
- Existing Google-linked user logs in and gets the same `{access}` + rotated httpOnly refresh cookie as password login.
- Existing password-only email attempting Google gets `409` + "sign in with password first" message; no account created, no login.
- Authed Profile gets "Link Gmail account" / "Connect Google" button calling the link endpoint; after linking, Google login works.
- `GET /api/auth/me/`, 401 → refresh-once → retry, rotation + blacklist behavior unchanged.

## Non-goals
- Removing or replacing password login.
- Gmail/contacts import, Google API scopes, offline access, Google refresh tokens.
- Email-verification change.
- Unlink / disconnect Google in v1 (defer; note below).
- Frontend-only token trust.

## Anti-goals
- Never trust client-supplied email; only the server-verified `sub` + `email` from Google.
- Never expose refresh token to JS; never put tokens in URLs or localStorage.
- No cross-user takeover via duplicate email.

## Constraints (from repo)
- `server/AGENTS.md`: `JWTAuthentication` only, `IsAuthenticated` default, Postgres via `DATABASE_URL`, `transaction.atomic()` on multi-step writes, drf-spectacular annotations + `server/schema.yml` in sync, new dependency needs explicit OK (`google-auth`). Token lifetimes: access 30m / refresh 30d, `ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION`, `REFRESH_COOKIE_MAX_AGE = 2592000`.
- `client/AGENTS.md`: access token in memory only, 401 → try refresh once then force login, money/contract rules untouched, never hand-edit `src/api/schema.d.ts` (backend first, then `npm run gen:api`), verify against live `runserver`.
- Google: verify signature + `aud == GOOGLE_CLIENT_ID` + expiry + `iss` (`accounts.google.com` / `https://accounts.google.com`) server-side; `GOOGLE_CLIENT_ID` in `server/.env`/env + `VITE_GOOGLE_CLIENT_ID` in client env.

## Approaches considered
1. **ID-token flow with GIS (picked):** client gets ID token from GIS button, POSTs to `POST /api/auth/google/`; backend verifies with `google-auth` and issues same JWT pair. Second authed endpoint `POST /api/auth/google/link/` verifies and stores Google `sub`. One small dep, no redirects, fits split Vercel cross-site cookie setup.
2. **Full OAuth code flow with django-allauth / dj-rest-auth:** redirect to Google + callback + SocialAccount tables. Rejected — 2 heavy deps, redirect/state handling, rewrites current cookie-JWT shape; overkill for identity-only.
3. **Frontend-only email trust:** decode credential in React and trust `email`. Ruled out — forgeable, violates "never trust client ownership".

Picked 1 because it meets the requirement with the narrowest new attack surface and zero change to how existing endpoints authenticate.

## The design (decided)

### Backend (`server/users/`, `config/settings.py`)
- **Settings:** `GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")`; fail closed (400/503, no traceback) if unset on Google endpoints.
- **Verify helper (`users/google.py`, new):** `google.oauth2.id_token.verify_oauth2_token(id_token, Request(), GOOGLE_CLIENT_ID)`; catch `ValueError` → 401/400; enforce `email_verified` true.
- **Login (`POST /api/auth/google/`, AllowAny):** input `{id_token}`; verified payload gives `sub`, `email` (lowercased). Lookup by stored `google_sub` first, then by `email__iexact`. Cases: (a) `google_sub` match → login; (b) email match with same `google_sub` or newly linkable? No — if email exists but `google_sub` differs/empty → `409` with code `password_account_exists`; (c) no user → create `User(username=<derived>, email=<lower>, password=unusable)` + store `sub`, then login. Issue via `RefreshToken.for_user(user)` + existing `set_refresh_cookie`, return `{access}` only.
- **Link (`POST /api/auth/google/link/`, IsAuthenticated):** input `{id_token}`; verify as above; if `sub` already linked to another user → `409`; if current user already linked to different `sub` → `409` (no silent overwrite in v1); else store `sub` (+ optionally `google_email`) and return 200 with user. All writes in `transaction.atomic()`.
- **User store:** needs a place for Google `sub` — builder picks smallest migration-consistent option (e.g. new `users.GoogleAccount(user OneToOne, sub unique, email)` or field on profile model; do NOT change custom-vs-default User decision without explicit OK per guardrail). `sub` globally unique.
- **Username derive:** `email.split("@")[0]` slugified, suffix `+n`/`_n` on collision; builder implements helper + test.
- **Schema:** `extend_schema` on both endpoints; regenerate `server/schema.yml`.

### Frontend (`client/src/api/`, `client/src/features/auth/`)
- **Env:** `VITE_GOOGLE_CLIENT_ID`; GIS script loaded lazily on Login/Profile only (no global blocking script).
- **`api/auth.ts`:** `googleLogin: (id_token) => POST /api/auth/google/` returns `{access}`; `googleLink: (id_token) => POST /api/auth/google/link/`; reuse `setTokens({access})` + existing `withCredentials` cookie flow; map `409 password_account_exists` to "An account with this email already exists — sign in with password first, then link Gmail in Profile."
- **LoginPage:** "Continue with Google" button above email form (shadcn `Button` + Google "G" affordance, keyboard-accessible, loading/disabled while GIS pending, error via existing `Alert`); on GIS credential → `googleLogin` mutation → success navigates same as password login.
- **ProfilePage:** "Link Gmail account" section: shows linked state (linked email + Disconnect deferred → disabled note in v1), else "Connect Google" button with same GIS → `googleLink` flow; loading/empty/error states per `prd.md` §10.
- **Verify:** `npm run typecheck`, `npm run build`, live smoke against `runserver`: new Google → account created + reload persists; linked Google → login; password-only email via Google → 409 message; password login → Profile link → logout → Google login works.

## What's left to the builder
- Exact store for `sub` (new model vs profile field) + migration.
- GIS button exact component (Google-rendered vs custom) and script-loader helper.
- 409 error code shape (`{detail, code}`) and copy.
- Whether Register page also gets the Google button or redirects to Login.
- `users/tests.py`: new-Google creates, linked-Google logs in, password-only Google → 409, link-while-authed works, forged/expired/wrong-aud token → 4xx, `sub` collision across users blocked, no model-money changes.
- Deployment note: create Google Cloud OAuth Client ID(s) for localhost + prod origins; set `GOOGLE_CLIENT_ID` server-side and `VITE_GOOGLE_CLIENT_ID` client-side; `Secure` cookies already require HTTPS in prod.
