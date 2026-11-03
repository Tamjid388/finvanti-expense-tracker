# Google Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Continue with Google" login plus Profile "Link Gmail account" while keeping the existing JWT access-in-body + httpOnly refresh-cookie flow unchanged.

**Architecture:** Frontend gets a Google ID token via Google Identity Services (GIS); backend verifies it server-side with `google-auth` (`verify_oauth2_token`, `aud==GOOGLE_CLIENT_ID`), maps `sub`/`email` to a `User`, and issues the same `RefreshToken.for_user()` + `set_refresh_cookie()` pair as password login.

**Tech Stack:** Django 6.1.2, DRF 3.18.3, Simple JWT 5.5.1 + `google-auth`, React 19 + Vite + TanStack Query + axios (`withCredentials`).

**Token lifetimes (updated per owner):** access 30m / refresh 30d, `ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION`. `REFRESH_COOKIE_MAX_AGE = 2592000` (30d).

**Commit policy (updated per owner):** no per-task commits. Single commit at the very end with bullet points.

**Spec:** `docs/superpowers/specs/2026-10-30-google-signin-design.md`

## Global Constraints

- `JWTAuthentication` only; `IsAuthenticated` default — no session auth, no custom DRF auth class.
- Access 30m / refresh 30d, `ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION` — login/refresh responses return `{access}` only, refresh travels in httpOnly cookie (`REFRESH_COOKIE_MAX_AGE = 2592000`).
- Postgres via `DATABASE_URL` only; multi-step writes in `transaction.atomic()`.
- Money stays `DecimalField` serialized as decimal strings (untouched by this plan).
- `server/schema.yml` regenerated after route changes (`python manage.py spectacular --file schema.yml`); never hand-edit `client/src/api/schema.d.ts` (run `npm run gen:api`).
- Never trust client `email`/`owner`; only server-verified Google `sub` + `email`; 409 for password-account collision, 404-not-403 discipline for user resources (unchanged).
- Never commit secrets, tokens, `.env`, `venv/`, `db.sqlite3`, `__pycache__`.

## Review Focus

- Forged/expired/wrong-`aud` ID token must 401/400, never create or log in a user.
- Existing password-only email attempting Google must get `409 password_account_exists`, never auto-link or log in.
- `sub` already linked to a different user must get `409`, never overwrite or merge accounts.
- Google-created users must have unusable passwords (password login with any password still 401).
- GIS script failure / popup closed / `VITE_GOOGLE_CLIENT_ID` missing must render an inline error state, never hang the Login button or crash the page.

---

## File Structure

**Backend (`server/`):**
- Create `server/users/google.py` — `verify_google_id_token(id_token: str) -> dict` (aud/iss/expiry/`email_verified` enforced) + `derive_username(email: str) -> str` (collision-suffixed).
- Create `server/users/models_google.py` (or `users/models.py` if empty scaffold) — `GoogleAccount(user OneToOne, sub unique, email)`; one migration `users/migrations/XXXX_google_account.py`.
- Modify `server/config/settings.py` — add `GOOGLE_CLIENT_ID`, change `ACCESS_TOKEN_LIFETIME` to 30m / `REFRESH_TOKEN_LIFETIME` to 30d, change `REFRESH_COOKIE_MAX_AGE` to 2592000.
- Modify `server/requirements.txt` + `server/pyproject.toml` — add `google-auth` (+ its `requests` transport dep, same pin in both files).
- Modify `server/users/serializers.py` — add `GoogleLoginSerializer(id_token)`, `GoogleLinkSerializer(id_token)`.
- Modify `server/users/views.py` — add `GoogleLoginView (AllowAny, POST /api/auth/google/)`, `GoogleLinkView (IsAuthenticated, POST /api/auth/google/link/)`, both using `set_refresh_cookie` / `RefreshToken.for_user`.
- Modify `server/users/urls.py` — mount the two routes.
- Modify `server/users/tests.py` — new `GoogleAuthTests` class (mocked verifier).
- Regenerate `server/schema.yml`.

**Frontend (`client/`):**
- Modify `client/.env.example` — add `VITE_GOOGLE_CLIENT_ID=`.
- Modify `client/src/config/env.ts` — export `GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""`.
- Create `client/src/features/auth/lib/google-identity.ts` — lazy GIS script loader + `requestGoogleIdToken(): Promise<string>`.
- Modify `client/src/api/auth.ts` — add `googleLogin(id_token)`, `googleLink(id_token)`.
- Modify `client/src/types/api.ts` — add `GoogleLoginPayload {id_token: string}`, `GoogleLinkResponse`, `MeWithGoogle` extension (optional `google_email: string | null`).
- Modify `client/src/features/auth/hooks/use-auth.ts` — add `useGoogleLogin()`, `useGoogleLink()`.
- Modify `client/src/features/auth/pages/LoginPage.tsx` — "Continue with Google" button + 409 copy.
- Modify `client/src/features/profile/pages/ProfilePage.tsx` — "Link Gmail account" card section.

**Docs:**
- Modify `server/.env.example` (or create if missing) — document `GOOGLE_CLIENT_ID=`.
- This plan file itself.

**Out of scope for this plan (needs separate spec/plan):** Change Password + Forgot/Reset Password — requested by user but not in the Google spec; email backend today is console-only, so reset-mail delivery needs its own decision.

## Inputs Required From You (blockers before live smoke)

- **Google Cloud OAuth Client ID (Web application type):** create at `console.cloud.google.com → APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application`. Authorized JavaScript origins must include `http://localhost:5173` (dev) and your production frontend origin(s) (e.g. `https://<app>.vercel.app`). Authorized redirect URIs: none needed (GIS ID-token flow, no redirect).
- **Server env:** set `GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com` in `server/.env` locally and in the backend host env (Vercel project env) for deployed API. Without it Google endpoints fail closed.
- **Client env:** set `VITE_GOOGLE_CLIENT_ID=<same-client-id>` in `client/.env.local` locally and `VITE_GOOGLE_CLIENT_ID` in the frontend host env. Without it the Google buttons render a "not configured" error state.
- **Decision (one line):** confirm v1 ships without Unlink/Disconnect (button shows linked state + disabled note) — unlink comes later.
- **New dependency approval (per `server/AGENTS.md`):** confirm adding `google-auth` to `server/requirements.txt`.

---

### Task 1: Backend verify helper + GoogleAccount store

**Files:**
- Create: `server/users/google.py`
- Create: `server/users/models.py` (or extend if scaffold exists — check before editing)
- Create: `server/users/migrations/XXXX_google_account.py` (via `makemigrations`)
- Modify: `server/config/settings.py`
- Modify: `server/requirements.txt`
- Test: `server/users/tests.py` (new `GoogleVerifyTests` + model uniqueness test)

**Interfaces:**
- Consumes: `settings.GOOGLE_CLIENT_ID`, `settings.REFRESH_COOKIE_*` (existing).
- Produces: `verify_google_id_token(id_token: str) -> dict{sub, email, email_verified}`; `derive_username(email: str) -> str`; model `users.GoogleAccount(user: OneToOne[User], sub: str unique, email: str)`.

- [ ] **Step 1: Write the failing test**

```python
def test_verify_rejects_wrong_aud():
    with self.assertRaises(Exception):
        verify_google_id_token("forged.token.here")

def test_google_sub_unique_across_users():
    GoogleAccount.objects.create(user=self.u1, sub="sub-123", email="a@x.com")
    with self.assertRaises(IntegrityError):
        GoogleAccount.objects.create(user=self.u2, sub="sub-123", email="b@x.com")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python manage.py test users -v 2` (from `server/` with `DATABASE_URL` set)
Expected: FAIL — `verify_google_id_token` / `GoogleAccount` not defined.

- [ ] **Step 3: Implement `verify_google_id_token(id_token: str) -> dict` in `server/users/google.py`**

Use `google.oauth2.id_token.verify_oauth2_token(id_token, google.auth.transport.requests.Request(), settings.GOOGLE_CLIENT_ID)`; raise `AuthenticationFailed` on `ValueError`; enforce `payload.get("email_verified") is True` and `payload["iss"] in ("accounts.google.com", "https://accounts.google.com")`; fail closed if `GOOGLE_CLIENT_ID` empty. `derive_username(email)`: `slugify(email.split("@")[0])[:30] or "user"`, suffix `_n` until `User.username` free.

- [ ] **Step 4: Add `GOOGLE_CLIENT_ID` to `config/settings.py`, `google-auth` to `requirements.txt`, `GoogleAccount` model + migration**

Model: `user = OneToOneField(User, on_delete=CASCADE, related_name="google_account")`, `sub = CharField(max_length=255, unique=True)`, `email = EmailField()`. Run `python manage.py makemigrations users`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `python manage.py test users -v 2`
Expected: PASS. Also run `python manage.py check`.

- [ ] **Step 6: No commit (single final commit at end per owner)**

### Task 2: Backend Google login + link endpoints

**Files:**
- Modify: `server/users/serializers.py`
- Modify: `server/users/views.py`
- Modify: `server/users/urls.py`
- Modify: `server/schema.yml` (regenerated)
- Test: `server/users/tests.py` (extend `GoogleAuthTests` with mocked `verify_google_id_token`)

**Interfaces:**
- Consumes: `verify_google_id_token`, `derive_username`, `GoogleAccount`, `set_refresh_cookie`, `RefreshToken.for_user`.
- Produces: `POST /api/auth/google/ {id_token} -> {access} (AllowAny)`; `POST /api/auth/google/link/ {id_token} -> 200 {id, username, email} (IsAuthenticated)`; errors `{detail, code: "password_account_exists" | "sub_already_linked"}` with 409.

- [ ] **Step 1: Write the failing tests (mock verifier, never hit Google)**

```python
@patch("users.views.verify_google_id_token", return_value={"sub": "sub-new", "email": "new@gmail.com", "email_verified": True})
def test_google_login_creates_user_and_sets_cookie(self, _mock):
    res = self.client.post("/api/auth/google/", {"id_token": "t"}, format="json")
    self.assertEqual(res.status_code, 200)
    self.assertIn("access", res.data)
    self.assertNotIn("refresh", res.data)
    self.assertIn("refresh_token", res.cookies)

@patch("users.views.verify_google_id_token", return_value={"sub": "sub-x", "email": "RAFI@example.com", "email_verified": True})
def test_google_login_existing_password_email_409(self, _mock):
    res = self.client.post("/api/auth/google/", {"id_token": "t"}, format="json")
    self.assertEqual(res.status_code, 409)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python manage.py test users -v 2`
Expected: FAIL — routes return 404.

- [ ] **Step 3: Implement `GoogleLoginSerializer`, `GoogleLinkSerializer` in `users/serializers.py`**

Each: single field `id_token = CharField(write_only=True, required=True)`. No email input — email comes only from the verified payload.

- [ ] **Step 4: Implement `GoogleLoginView` + `GoogleLinkView` in `users/views.py`, mount in `users/urls.py`**

Login logic (in `transaction.atomic()`): verify → `email.lower()`; `GoogleAccount.objects.select_related("user").filter(sub=sub).first()` → login; elif `User.objects.filter(email__iexact=email).exists()` → 409 `password_account_exists`; else create `User(username=derive_username(email), email=email)` with `set_unusable_password()` + `GoogleAccount(user, sub, email)`, then `RefreshToken.for_user(user)`, `set_refresh_cookie(response, str(refresh))`, return `{access}`. Link logic: verify → if `GoogleAccount.objects.filter(sub=sub).exclude(user=request.user).exists()` → 409; if `request.user` has account with different `sub` → 409; else `update_or_create`. Annotate both with `extend_schema`.

- [ ] **Step 5: Regenerate schema and run tests**

Run: `python manage.py spectacular --file schema.yml` then `python manage.py test users -v 2`
Expected: PASS, `schema.yml` diff shows `/api/auth/google/` + `/api/auth/google/link/`.

- [ ] **Step 6: No commit (single final commit at end per owner)**

### Task 3: Frontend auth transport + GIS loader

**Files:**
- Modify: `client/.env.example`
- Modify: `client/src/config/env.ts`
- Create: `client/src/features/auth/lib/google-identity.ts`
- Modify: `client/src/api/auth.ts`
- Modify: `client/src/types/api.ts`
- Test: manual (no runner per `client/AGENTS.md`) — `npm run typecheck`

**Interfaces:**
- Consumes: `VITE_GOOGLE_CLIENT_ID`, `api.post`, `setTokens`.
- Produces: `loadGisScript(): Promise<void>`; `requestGoogleIdToken(): Promise<string>`; `authApi.googleLogin(id_token: string): Promise<{access: string}>`; `authApi.googleLink(id_token: string): Promise<User>`; types `GoogleLoginPayload {id_token: string}`.

- [ ] **Step 1: Write the typecheck gate (failing)**

Add `authApi.googleLogin` call in a scratch check (or run `npm run typecheck` after adding the call sites in Task 4 — this task defines the functions so the gate passes).
Expected before: `Property 'googleLogin' does not exist`.

- [ ] **Step 2: Implement `google-identity.ts`**

Lazy-load `https://accounts.google.com/gsi/client` once (singleton promise); `requestGoogleIdToken()` initializes `google.accounts.oauth2.initTokenClient`? No — use One-Tap/Button credential flow: `google.accounts.id.initialize({client_id: GOOGLE_CLIENT_ID, callback})` + `renderButton` or `prompt()`; resolve with `credential` (ID token), reject on close/error/missing client ID with `ApiError`-compatible `Error("Google sign-in is not configured")`. No token stored in localStorage.

- [ ] **Step 3: Implement `authApi.googleLogin / googleLink` + `env.ts` + `.env.example` + `types/api.ts`**

`googleLogin: (id_token) => api.post<{access: string}>("/api/auth/google/", {id_token})`; `googleLink: (id_token) => api.post<User>("/api/auth/google/link/", {id_token})`. `GOOGLE_CLIENT_ID` export + `VITE_GOOGLE_CLIENT_ID=` doc line. Add `NO_AUTO_REFRESH` parity: Google 409 must surface to the form, never trigger silent refresh (extend `NO_AUTO_REFRESH_PATHS` with `/api/auth/google/`).

- [ ] **Step 4: Verify**

Run: `npm run typecheck` (from `client/`)
Expected: PASS with no errors.

- [ ] **Step 5: No commit (single final commit at end per owner)**

### Task 4: Login + Profile Google UI

**Files:**
- Modify: `client/src/features/auth/hooks/use-auth.ts`
- Modify: `client/src/features/auth/pages/LoginPage.tsx`
- Modify: `client/src/features/profile/pages/ProfilePage.tsx`
- Test: manual smoke (no runner) + `npm run typecheck && npm run build`

**Interfaces:**
- Consumes: `authApi.googleLogin/googleLink`, `requestGoogleIdToken`, `setTokens`, `qk.me`.
- Produces: `useGoogleLogin(): UseMutation`; `useGoogleLink(): UseMutation`; Login "Continue with Google" button; Profile "Link Gmail account" section.

- [ ] **Step 1: Implement `useGoogleLogin()` in `use-auth.ts`**

`mutationFn: async () => { const id_token = await requestGoogleIdToken(); const res = await authApi.googleLogin(id_token); setTokens(res); }`, `onSuccess`: same `from`-bounce + `toast("Signed in with Google")` as `useLogin`; map 409 `password_account_exists` to form error "An account with this email already exists — sign in with password first, then link Gmail in Profile."

- [ ] **Step 2: Implement LoginPage button**

"Continue with Google" full-width outline `Button` above the email form with Google "G" affordance, `disabled` while pending, keyboard-accessible, errors via existing `Alert`; successful login navigates identically to password login. Register page: no separate button (reuses Login entry point per spec).

- [ ] **Step 3: Implement `useGoogleLink()` + Profile section**

`useGoogleLink`: `mutationFn: async () => { const id_token = await requestGoogleIdToken(); return authApi.googleLink(id_token); }`, `onSuccess`: `qc.invalidateQueries({queryKey: qk.me()})` + toast. Profile card "Link Gmail account": if `me.data.google_email` (or linked flag once backend exposes it) show linked email + disabled "Disconnect (coming soon)" note; else "Connect Google" button + loading/error states per `prd.md` §10.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run build` (from `client/`)
Expected: PASS. Live smoke (needs your Client ID + server running): new Google → account created; linked Google → login; password-only email → 409 message; password login → Profile link → logout → Google login works; reload persists via cookie.

- [ ] **Step 5: No commit (single final commit at end per owner)**

### Task 5: Docs, schema regen check, end-to-end verification

**Files:**
- Modify: `server/.env.example` (create if missing — check repo root/`server/` first)
- Modify: `server/schema.yml` (final regen if drifted)
- Modify: `client/.env.example` (confirm `VITE_GOOGLE_CLIENT_ID` present)
- Test: full gates

- [ ] **Step 1: Document envs (values empty, owner fills later)**

`server/.env.example`: `GOOGLE_CLIENT_ID=` (empty). `client/.env.example`: `VITE_GOOGLE_CLIENT_ID=` (empty) plus comment lines explaining where to get them.

- [ ] **Step 2: Run backend gate**

Run: `python manage.py spectacular --file schema.yml && python manage.py check && python manage.py test users` (from `server/`)
Expected: PASS, `git diff --stat` shows only intended files.

- [ ] **Step 3: Run frontend gate**

Run: `npm run typecheck && npm run build` (from `client/`)
Expected: PASS.

- [ ] **Step 4: Live smoke with your credentials**

Prereqs from you: both env vars set, Django `runserver` + Vite `dev` running. Cases: (1) new Gmail → created + `me` correct; (2) logout → Google again → logged in, cookie `refresh_token` HttpOnly present; (3) password-only email → Google → 409 copy; (4) password login → Profile Connect → logout → Google → logged in; (5) forged token (paste garbage via devtools call) → 4xx, no session.

- [ ] **Step 5: No commit (single final commit at end per owner)**

### Task 6: Single final commit (owner policy — no per-task commits)

- [ ] **Step 1: Stage everything and commit once with bullet points**

```bash
git add -A
git commit -m "feat(auth): google sign-in + 30m/30d tokens
- backend google verify + GoogleAccount + /api/auth/google/ + /api/auth/google/link/
- token lifetimes 30m access / 30d refresh + cookie max-age 30d
- frontend GIS loader + Continue with Google + Profile Link Gmail
- env keys GOOGLE_CLIENT_ID / VITE_GOOGLE_CLIENT_ID (empty, owner fills)
- schema.yml regenerated"
```
