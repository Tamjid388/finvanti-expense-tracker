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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  const apiError = register.error instanceof ApiError ? register.error : null;
  const isConnectionError = apiError?.status === 0;
  const message = !apiError
    ? "Registration failed — please try again."
    : isConnectionError
      ? apiError.message
      : (apiError.fieldErrors && Object.values(apiError.fieldErrors)[0]) || apiError.message;

  return (
    <div className="auth-backdrop flex min-h-dvh flex-col p-4">
      <Card className="m-auto w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your {APP_NAME} account</CardTitle>
          <CardDescription>One account keeps every record private to you.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {register.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Registration failed</AlertTitle>
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
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                placeholder="Choose a username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="h-11 text-base md:h-12 md:text-base"
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
                className="h-11 text-base md:h-12 md:text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Create a password"
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
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  required
                  aria-invalid={confirmMismatch}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-11 pr-10 text-base md:h-12 md:text-base"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  aria-pressed={showConfirmPassword}
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute top-1/2 right-1 size-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </Button>
              </div>
              {confirmMismatch ? (
                <p className="text-sm text-destructive">Passwords do not match.</p>
              ) : null}
            </div>
            <Button type="submit" size="lg" disabled={register.isPending}>
              {register.isPending ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          <span>
            Already have an account?&nbsp;
            <Button variant="link" size="sm" className="h-auto p-0" asChild>
              <Link to={ROUTES.login}>Sign in</Link>
            </Button>
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
