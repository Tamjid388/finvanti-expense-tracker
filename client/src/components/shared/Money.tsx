import type { MoneyString } from "@/types/api";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Canonical money display — always BDT-formatted (PRD §10: consistent currency). */
export function Money({ amount, className }: { amount: MoneyString; className?: string }) {
  return <span className={cn("tabular-nums whitespace-nowrap", className)}>{formatMoney(amount)}</span>;
}
