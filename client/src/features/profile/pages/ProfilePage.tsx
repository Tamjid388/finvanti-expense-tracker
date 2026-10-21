import { CircleUser, LogOut } from "lucide-react";

import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { useLogout, useMe } from "@/features/auth/hooks/use-auth";

/** Wireframe profile screen: account card + sessions & security card. */
export function ProfilePage() {
  const me = useMe();
  const logout = useLogout();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account and sign-in sessions.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Account</CardTitle>
            {me.data ? <Badge variant="secondary">Verified</Badge> : null}
          </CardHeader>
          <CardContent className="grid gap-4">
            {me.isPending ? (
              <div className="flex items-center gap-4">
                <Skeleton className="size-10 rounded-full" aria-hidden />
                <div className="grid w-full gap-1.5">
                  <Skeleton className="h-5 w-40" aria-hidden />
                  <Skeleton className="h-4 w-56" aria-hidden />
                </div>
              </div>
            ) : me.isError ? (
              <ErrorState
                title="Couldn't load your profile"
                description={
                  me.error instanceof ApiError ? me.error.message : "Please try again in a moment."
                }
                onRetry={() => void me.refetch()}
              />
            ) : me.data ? (
              <>
                <div className="flex items-center gap-4">
                  <span
                    className="flex size-10 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
                    aria-hidden
                  >
                    {(me.data.username || me.data.email || "U").slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-medium">{me.data.username}</p>
                    <p className="text-sm text-muted-foreground">{me.data.email}</p>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-currency">Default currency</Label>
                  <Input id="profile-currency" value="BDT — Bangladeshi Taka" disabled />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sessions &amp; security</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
              <div className="text-sm">
                <p className="font-medium">This device</p>
                <p className="text-xs text-muted-foreground">Renews itself automatically while you use the app</p>
              </div>
              <Badge variant="secondary">Current</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Signing out ends this session on this device. You can sign back in anytime.
            </p>
            <Separator />
            {logout.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {logout.error instanceof ApiError
                  ? logout.error.message
                  : "Couldn't sign out cleanly — your local session was still cleared."}
              </p>
            ) : null}
            <div>
              <Button variant="destructive" disabled={logout.isPending} onClick={() => logout.mutate()}>
                <LogOut className="size-4" aria-hidden />
                {logout.isPending ? "Signing out…" : "Log out"}
              </Button>
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CircleUser className="size-3.5" aria-hidden />
              Access tokens stay usable until expiry. The client clears storage on logout.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
