import { TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Dashboard summary cards — values land here via /api/reports/monthly-summary/. */
export function SummaryCards() {
  const cards = [
    { title: "Income — this month", icon: TrendingUp },
    { title: "Expense — this month", icon: TrendingDown },
    { title: "Net balance", icon: Wallet },
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <card.icon className="size-4" aria-hidden />
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-28" aria-hidden />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
