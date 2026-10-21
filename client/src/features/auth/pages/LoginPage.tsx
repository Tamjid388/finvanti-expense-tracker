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

  const message =
    login.error instanceof ApiError
      ? login.error.message
      : "Sign in failed — please try again.";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to {APP_NAME}</CardTitle>
          <CardDescription>Track income, expenses, budgets and reports.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Alert variant="destructive" className="border-dashed">
            <AlertTitle>Backend not connected</AlertTitle>
            <AlertDescription>
              Start the API first: <code className="text-xs">python manage.py runserver</code> in{" "}
              <code className="text-xs">server/</code>.
            </AlertDescription>
          </Alert>

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

          {login.isError ? <p className="text-sm text-destructive">{message}</p> : null}
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
