import { useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@/api/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/constants";
import { useRegister } from "../hooks/use-auth";

/**
 * Wireframe register form — payload mirrors server/schema.yml `Register`
 * (username / email / password all required).
 */
export function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const register = useRegister();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setConfirmMismatch(true);
      return;
    }
    setConfirmMismatch(false);
    register.mutate({ username, email, password });
  };

  const message =
    register.error instanceof ApiError
      ? register.error.message
      : "Registration failed — please try again.";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your {APP_NAME} account</CardTitle>
          <CardDescription>One account keeps every record private to you.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Alert className="border-dashed">
            <AlertTitle>Backend not connected</AlertTitle>
            <AlertDescription>
              Start the API first: <code className="text-xs">python manage.py runserver</code> in{" "}
              <code className="text-xs">server/</code>.
            </AlertDescription>
          </Alert>

          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
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
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                aria-invalid={confirmMismatch}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              {confirmMismatch ? (
                <p className="text-sm text-destructive">Passwords do not match.</p>
              ) : null}
            </div>
            <Button type="submit" disabled={register.isPending}>
              {register.isPending ? "Creating account…" : "Create account"}
            </Button>
          </form>

          {register.isError ? <p className="text-sm text-destructive">{message}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
