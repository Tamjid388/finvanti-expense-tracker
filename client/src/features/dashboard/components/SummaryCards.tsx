import { TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/shared/Money";
import type { MonthlySummary } from "@/types/api";

/** Dashboard KPI cards — values come from GET /api/reports/monthly-summary/. */
export function SummaryCards({
  summary,
  isPending,
}: {
  summary: MonthlySummary | undefined;
  isPending: boolean;
}) {
  const cards = [
    { title: "Income — this month", icon: TrendingUp, tone: "text-green-600", value: summary?.total_income },
    { title: "Expense — this month", icon: TrendingDown, tone: "text-red-600", value: summary?.total_expenses },
    { title: "Net balance", icon: Wallet, tone: "", value: summary?.net_balance },
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
            {isPending ? (
              <Skeleton className="h-7 w-28" aria-hidden />
            ) : card.value === undefined ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              <span className={`text-2xl font-semibold tabular-nums ${card.tone}`}>
                <Money amount={card.value} />
              </span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
