import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

let seq = 0;

/** Wireframe `toast(m)` — bottom pill, auto-dismisses after ~2.2s. */
export function toast(message: string): void {
  window.dispatchEvent(
    new CustomEvent<{ id: number; message: string }>("app-toast", {
      detail: { id: ++seq, message },
    }),
  );
}

export function Toaster() {
  const [items, setItems] = useState<ReadonlyArray<{ id: number; message: string }>>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const { id, message } = (event as CustomEvent<{ id: number; message: string }>).detail;
      setItems((prev) => [...prev.slice(-2), { id, message }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }, 2200);
    };
    window.addEventListener("app-toast", onToast);
    return () => window.removeEventListener("app-toast", onToast);
  }, []);

  if (items.length === 0) return null;
  const latest = items[items.length - 1];

  return (
    <div
      aria-live="polite"
      className={cn(
        "fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full",
        "bg-foreground px-4 py-2 text-sm text-background shadow-lg",
      )}
    >
      {latest.message}
    </div>
  );
}
