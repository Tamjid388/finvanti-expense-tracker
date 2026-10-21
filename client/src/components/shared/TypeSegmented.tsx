import { Button } from "@/components/ui/button";
import { TXN_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TxnType } from "@/types/api";

const LABELS: Record<TxnType, string> = { income: "Income", expense: "Expense" };

/**
 * Wireframe `txnTypeSeg` — the type selector that also drives the category
 * dropdown (category.type must match txn.type, PRD §9). Clicking the active
 * option de-selects it, i.e. "All".
 */
export function TypeSegmented({
  value,
  onChange,
  className,
}: {
  value: TxnType | null;
  onChange: (type: TxnType) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Filter by transaction type"
      className={cn("inline-flex items-center gap-0.5 rounded-lg border p-0.5", className)}
    >
      {TXN_TYPES.map((type) => (
        <Button
          key={type}
          type="button"
          variant={value === type ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={value === type}
          className={value === type ? "" : "text-muted-foreground"}
          onClick={() => onChange(type)}
        >
          {LABELS[type]}
        </Button>
      ))}
    </div>
  );
}
