import { useState } from "react";
import type { FormEvent } from "react";

import { Link } from "react-router";
import { Eye, EyeOff } from "lucide-react";

import { ApiError } from "@/api/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/config/routes";
import { APP_NAME } from "@/lib/constants";
import { useGoogleLogin, useLogin } from "../hooks/use-auth";

/**
 * Dummy demo account for one-click local sign-in.
 * `import.meta.env.DEV` folds to `false` in production builds — the object and
 * its button get dead-code-eliminated, so no credentials ship in prod bundles.
 */
const DEMO_ACCOUNT = import.meta.env.DEV
  ? { email: "tamjid@gmail.com", password: "112233" }
  : null;

/**
 * Wireframe auth gate (docs/wireframes/web). Payload mirrors
 * server/schema.yml `EmailTokenObtainPair` (email + password).
 */
export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();
  const googleLogin = useGoogleLogin();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate({ email, password });
  };

  const handleDemoLogin = () => {
    if (!DEMO_ACCOUNT) return;
    // Fill the inputs so it's obvious what the dummy button used.
    setEmail(DEMO_ACCOUNT.email);
    setPassword(DEMO_ACCOUNT.password);
    // Same real login flow as {@link handleSubmit} — no auth bypass.
    login.mutate(DEMO_ACCOUNT);
  };

  const apiError =
    googleLogin.error instanceof ApiError ? googleLogin.error : login.error instanceof ApiError ? login.error : null;
  const isConnectionError = apiError?.status === 0;
  const isPasswordExists409 =
    apiError?.status === 409 && /already exists/i.test(apiError.message);
  const message = !apiError
    ? "Sign in failed — please try again."
    : isConnectionError
      ? apiError.message
      : isPasswordExists409
        ? "An account with this email already exists — sign in with password first, then link Gmail in Profile."
        : apiError.status === 400 || apiError.status === 401
          ? "Incorrect email or password. Please try again."
          : apiError.message;

  const googleError = googleLogin.error instanceof Error ? googleLogin.error : null;

  return (
    <div className="auth-backdrop flex min-h-dvh flex-col p-4">
      <Card className="m-auto w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to {APP_NAME}</CardTitle>
          <CardDescription>Track income, expenses, budgets and reports.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={googleLogin.isPending || login.isPending}
            onClick={() => googleLogin.mutate()}
            aria-label="Continue with Google"
          >
            <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.35 11.1H12v2.9h5.35c-.5 2.4-2.55 3.5-5.35 3.5a5.9 5.9 0 0 1 0-11.8c1.5 0 2.85.55 3.9 1.45l2.1-2.1A8.9 8.9 0 0 0 12 2a8.9 8.9 0 0 0 0 17.8c4.6 0 7.65-3.2 7.65-7.7 0-.35-.05-.7-.1-1z"
              />
            </svg>
            {googleLogin.isPending ? "Connecting to Google…" : "Continue with Google"}
          </Button>
          {googleLogin.isError && !login.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Google sign-in failed</AlertTitle>
              <AlertDescription>{googleError?.message ?? message}</AlertDescription>
            </Alert>
          ) : null}
          {login.isError || (googleLogin.isError && login.isError) ? (
            <Alert variant="destructive">
              <AlertTitle>Sign in failed</AlertTitle>
              <AlertDescription>
                {message}
                {isConnectionError && import.meta.env.DEV ? (
                  <>
                    <br />
                    <span className="text-xs opacity-80">
                      Dev hint: start the API with <code>python manage.py runserver</code> in{" "}
                      <code>server/</code>.
                    </span>
                  </>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 text-base md:h-12 md:text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 pr-10 text-base md:h-12 md:text-base"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-1 size-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </Button>
              </div>
            </div>
            <Button type="submit" size="lg" disabled={login.isPending}>
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          {DEMO_ACCOUNT ? (
            <div className="grid gap-1">
              <Button
                type="button"
                variant="outline"
                disabled={login.isPending}
                onClick={handleDemoLogin}
              >
                Sign in as demo
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                dev convenience · {DEMO_ACCOUNT.email}
              </p>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          <span>
            No account yet?&nbsp;
            <Button variant="link" size="sm" className="h-auto p-0" asChild>
              <Link to={ROUTES.register}>Create one</Link>
            </Button>
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
