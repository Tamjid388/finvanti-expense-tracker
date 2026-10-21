import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlaceholderNotice } from "@/components/shared/PlaceholderNotice";
import { useMonthParam } from "@/hooks/use-month-param";

/** Wireframe budgets screen: month picker, budget cards, remaining math. */
export function BudgetsPage() {
  const { label, shiftMonth } = useMonthParam();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Budgets</h1>
        <p className="text-sm text-muted-foreground">
          Monthly limits per category — remaining = limit − spent.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Month lives in ?month=YYYY-MM — shared state for budgets + reports. */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <span className="w-40 text-center text-sm font-medium">{label}</span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
        <Button size="sm" disabled>
          <Plus className="size-4" aria-hidden />
          Add budget
        </Button>
      </div>

      <PlaceholderNotice />

      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((card) => (
          <Card key={card}>
            <CardHeader>
              <CardTitle className="text-base">
                <Skeleton className="h-5 w-28" aria-hidden />
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Skeleton className="h-5 w-full" aria-hidden />
              <Skeleton className="h-2 w-full" aria-hidden />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
