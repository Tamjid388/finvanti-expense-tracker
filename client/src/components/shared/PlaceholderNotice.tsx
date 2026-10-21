import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

/**
 * Banner used on placeholder screens: the UI mirrors the wireframes, but the
 * Django endpoints behind it are not connected yet (see client/ARCHITECTURE.md).
 */
export function PlaceholderNotice({ className }: { className?: string }) {
  return (
    <Alert className={cn("border-dashed", className)}>
      <AlertTitle>Placeholder screen</AlertTitle>
      <AlertDescription>
        The Django REST API is not wired to this screen yet — the layout mirrors{" "}
        <code className="text-xs">docs/wireframes/web/index.html</code>. Wire the feature hooks in{" "}
        <code className="text-xs">src/features/*/hooks</code> first.
      </AlertDescription>
    </Alert>
  );
}
