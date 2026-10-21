import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Generic async error surface. Callers pass pre-sanitized copy — never dump raw
 * ApiError detail straight from a 5xx (PRD §12: don't leak internals).
 */
export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center",
        className,
      )}
    >
      <TriangleAlert className="size-5 text-destructive" aria-hidden />
      <p className="font-medium">{title}</p>
      {description ? <p className="max-w-md text-sm text-destructive/90">{description}</p> : null}
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
