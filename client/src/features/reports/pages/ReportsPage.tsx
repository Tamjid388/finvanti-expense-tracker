import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlaceholderNotice } from "@/components/shared/PlaceholderNotice";
import { useMonthParam } from "@/hooks/use-month-param";

/** Wireframe reports screen: monthly summary, category breakdown, budget status. */
export function ReportsPage() {
  const { label, shiftMonth } = useMonthParam();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Aggregated in the database — and always consistent with your transactions.
        </p>
      </header>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <span className="w-40 text-center text-sm font-medium">{label}</span>
        <Button variant="outline" size="icon" aria-label="Next month" onClick={() => shiftMonth(1)}>
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>

      <PlaceholderNotice />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Skeleton className="h-5 w-full" aria-hidden />
          <Skeleton className="h-5 w-3/4" aria-hidden />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category breakdown</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-5 w-full" aria-hidden />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[0, 1].map((row) => (
              <Skeleton key={row} className="h-5 w-full" aria-hidden />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
