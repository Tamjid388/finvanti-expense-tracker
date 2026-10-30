import { TrendingDown, TrendingUp } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/shared/Money";
import type { MonthlySummary } from "@/types/api";

/** Mobile-only gradient hero — greeting + Income/Expense totals.
 *  Theme-matched: indigo primary (#4f46e5) → violet, white text.
 *  Rendered `md:hidden`; desktop keeps the plain header. */
export function MobileHeroCard({
  greeting,
  name,
  monthLabel,
  summary,
  isPending,
  overCount,
  nearCount,
}: {
  greeting: string;
  name: string;
  monthLabel: string;
  summary: MonthlySummary | undefined;
  isPending: boolean;
  overCount: number;
  nearCount: number;
}) {
  return (
    <section
      aria-label="Monthly overview"
      className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-5 text-white shadow-lg md:hidden"
    >
      <p className="text-sm text-indigo-100">
        {greeting}, {name} 👋
      </p>
      <p className="mt-0.5 text-xs text-indigo-200">{monthLabel} overview</p>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-4">
        <div className="grid gap-1">
          <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-indigo-100 uppercase">
            <TrendingUp className="size-3.5" aria-hidden />
            Income
          </span>
          {isPending ? (
            <Skeleton className="h-7 w-24 bg-white/30" aria-label="Loading income total" />
          ) : summary?.total_income === undefined ? (
            <span className="text-sm text-indigo-100">—</span>
          ) : (
            <Money amount={summary.total_income} className="text-xl font-semibold text-white" />
          )}
        </div>
        <div className="grid gap-1 border-l border-white/20 pl-3">
          <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-indigo-100 uppercase">
            <TrendingDown className="size-3.5" aria-hidden />
            Expense
          </span>
          {isPending ? (
            <Skeleton className="h-7 w-24 bg-white/30" aria-label="Loading expense total" />
          ) : summary?.total_expenses === undefined ? (
            <span className="text-sm text-indigo-100">—</span>
          ) : (
            <Money amount={summary.total_expenses} className="text-xl font-semibold text-white" />
          )}
        </div>
      </div>

      {overCount > 0 || nearCount > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {overCount > 0 ? (
            <span className="rounded-full border border-white/20 bg-white/20 px-2 py-0.5 text-[11px] font-medium text-white">
              {overCount} budget{overCount === 1 ? "" : "s"} over
            </span>
          ) : null}
          {nearCount > 0 ? (
            <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] font-medium text-indigo-50">
              {nearCount} near limit
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
