import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Month navigator bound to `?month=YYYY-MM` (budgets, reports, dashboard). */
export function MonthPager({
  label,
  month,
  onShift,
}: {
  label: string;
  month: string;
  onShift: (delta: number) => void;
}) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={`Month: ${month}`}>
      <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => onShift(-1)}>
        <ChevronLeft className="size-4" aria-hidden />
      </Button>
      <span className="w-40 text-center text-sm font-medium" aria-live="polite">
        {label}
      </span>
      <Button variant="outline" size="icon" aria-label="Next month" onClick={() => onShift(1)}>
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
