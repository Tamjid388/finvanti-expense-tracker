import { CircleUser, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PlaceholderNotice } from "@/components/shared/PlaceholderNotice";

/** Wireframe profile screen: identity row, settings, sign-out. */
export function ProfilePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account details.</p>
      </header>

      <PlaceholderNotice />

      <Card>
        <CardContent className="flex items-center gap-4">
          <CircleUser className="size-10 text-muted-foreground" aria-hidden />
          <div className="grid w-full gap-1.5">
            <Skeleton className="h-5 w-40" aria-hidden />
            <Skeleton className="h-4 w-56" aria-hidden />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sign out</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Blacklists this session&apos;s refresh token on the server, clears the in-memory
            session, and returns you to the sign-in screen.{" "}
            <code className="text-xs">POST /api/auth/logout/</code>
          </p>
          <Separator />
          <Button variant="outline" disabled>
            <LogOut className="size-4" aria-hidden />
            Sign out — connect API first
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
