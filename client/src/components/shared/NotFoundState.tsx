import { Inbox } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ROUTES } from "@/config/routes";

/** Catch-all route element for unknown paths. */
export function NotFoundState() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <EmptyState
        icon={<Inbox className="size-6" />}
        title="404 — page not found"
        description="The page you are looking for does not exist or has moved."
        action={
          <Button asChild>
            <Link to={ROUTES.dashboard}>Back to dashboard</Link>
          </Button>
        }
        className="w-full max-w-md"
      />
    </div>
  );
}
