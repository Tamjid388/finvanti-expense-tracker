import { useState } from "react";
import type { FormEvent } from "react";

import { Link } from "react-router";

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
import { useLogin } from "../hooks/use-auth";

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
  const login = useLogin();

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

  const apiError = login.error instanceof ApiError ? login.error : null;
  const isConnectionError = apiError?.status === 0;
  const message = !apiError
    ? "Sign in failed — please try again."
    : isConnectionError
      ? apiError.message
      : apiError.status === 400 || apiError.status === 401
        ? "Incorrect email or password. Please try again."
        : apiError.message;

  return (
    <div className="auth-backdrop flex min-h-dvh flex-col p-4">
      <Card className="m-auto w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to {APP_NAME}</CardTitle>
          <CardDescription>Track income, expenses, budgets and reports.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {login.isError ? (
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
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={login.isPending}>
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
