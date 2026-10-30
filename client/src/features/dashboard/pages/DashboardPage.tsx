import { Link } from "react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Money } from "@/components/shared/Money";
import { MonthPager } from "@/components/shared/MonthPager";
import { ROUTES } from "@/config/routes";
import { useMonthParam } from "@/hooks/use-month-param";
import { monthBounds } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { ApiError } from "@/api/client";
import { useMe } from "@/features/auth/hooks/use-auth";
import { useMonthlySummary, useCategoryBreakdown, useBudgetStatus } from "@/features/reports/hooks/use-reports";
import { useTransactions } from "@/features/transactions/hooks/use-transactions";
import { useCategories } from "@/features/categories/hooks/use-categories";

import { SummaryCards } from "../components/SummaryCards";
import { MobileHeroCard } from "../components/MobileHeroCard";

function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return error.message;
    if (error.status === 401) return "Your session expired. Please sign in again.";
    return error.message;
  }
  return "Couldn't load the dashboard. Please try again.";
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Wireframe dashboard: greeting, KPIs, budget status, category bars, recents. */
export function DashboardPage() {
  const { month, label, shiftMonth } = useMonthParam();
  const bounds = monthBounds(month);

  const me = useMe();
  const summary = useMonthlySummary(month);
  const budgetStatus = useBudgetStatus(month);
  const breakdown = useCategoryBreakdown(month, "expense");
  const recent = useTransactions({ start_date: bounds.start, end_date: bounds.end, page: 1 });
  const categories = useCategories();

  const categoryName = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
  const maxTotal = Math.max(0, ...(breakdown.data ?? []).map((row) => Number(row.total)));
  const topBudgets = (budgetStatus.data ?? []).slice(0, 4);
  const recentRows = (recent.data?.results ?? []).slice(0, 5);
  const overCount = (budgetStatus.data ?? []).filter((r) => r.is_over).length;
  const nearCount = (budgetStatus.data ?? []).filter((r) => {
    if (r.is_over || Number(r.limit) <= 0) return false;
    return Number(r.spent) / Number(r.limit) >= 0.85;
  }).length;

  const failed = summary.isError || budgetStatus.isError || breakdown.isError || recent.isError;
  const failedError = summary.error ?? budgetStatus.error ?? breakdown.error ?? recent.error;
  const name = me.data?.username || me.data?.email || "there";

  return (
    <div className="space-y-6">
      <MobileHeroCard
        greeting={greeting()}
        name={name}
        monthLabel={label}
        summary={summary.data}
        isPending={summary.isPending}
        overCount={overCount}
        nearCount={nearCount}
      />
      <header className="hidden flex-wrap items-center justify-between gap-3 md:flex">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            {greeting()}, {name} 👋
          </h1>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
            {summary.data ? (
              <>
                <span>
                  Income {formatMoney(summary.data.total_income)} · Expenses{" "}
                  {formatMoney(summary.data.total_expenses)}
                </span>
                {overCount > 0 ? (
                  <Badge variant="destructive">
                    {overCount} budget{overCount === 1 ? "" : "s"} over
                  </Badge>
                ) : null}
                {nearCount > 0 ? (
                  <Badge variant="secondary">
                    {nearCount} budget{nearCount === 1 ? "" : "s"} near limit
                  </Badge>
                ) : null}
              </>
            ) : (
              <span>This month&apos;s income, spending and net balance at a glance.</span>
            )}
          </p>
        </div>
        {/* Primary CTA — matches other primary buttons (bg-primary), large on desktop. */}
        <div className="flex flex-wrap items-center gap-3">
          <MonthPager label={label} month={month} onShift={shiftMonth} />
          <Button size="lg" className="w-full sm:w-auto lg:h-11 lg:px-6 lg:text-base" asChild>
            <Link to={`${ROUTES.reports}?month=${month}`}>View full report →</Link>
          </Button>
        </div>
      </header>

      {failed ? (
        <ErrorState
          title="Couldn't load the dashboard"
          description={friendlyError(failedError)}
          onRetry={() => {
            void summary.refetch();
            void budgetStatus.refetch();
            void breakdown.refetch();
            void recent.refetch();
          }}
        />
      ) : (
        <>
          <SummaryCards summary={summary.data} isPending={summary.isPending} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Budget status</CardTitle>
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <Link to={`${ROUTES.budgets}?month=${month}`}>Manage →</Link>
                </Button>
              </CardHeader>
              <CardContent className="grid gap-4">
                {budgetStatus.isPending ? (
                  <LoadingState label="Loading budgets…" />
                ) : topBudgets.length === 0 ? (
                  <EmptyState
                    title="No budgets this month"
                    description="Set a monthly limit to track spending against it."
                    action={
                      <Button variant="outline" asChild>
                        <Link to={`${ROUTES.budgets}?month=${month}`}>Set a budget</Link>
                      </Button>
                    }
                  />
                ) : (
                  topBudgets.map((row) => {
                    const spent = Number(row.spent);
                    const limit = Number(row.limit);
                    const percent = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
                    const budgetName =
                      row.category_id == null
                        ? "Overall"
                        : (categoryName.get(row.category_id) ?? `Category #${row.category_id}`);
                    const left = limit - spent;
                    return (
                      <div key={row.budget_id} className="grid gap-1">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-medium">{budgetName}</span>
                          <span className="text-muted-foreground tabular-nums">
                            <Money amount={row.spent} /> / <Money amount={row.limit} />
                          </span>
                        </div>
                        <div
                          className="h-2 overflow-hidden rounded-full bg-muted"
                          role="progressbar"
                          aria-valuenow={Math.round(percent)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${budgetName} budget progress`}
                        >
                          <div
                            className={`h-full rounded-full ${row.is_over ? "bg-red-500" : percent >= 85 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <p className={`text-xs ${row.is_over ? "font-medium text-red-600" : "text-muted-foreground"}`}>
                          {Math.round(percent)}% ·{" "}
                          {row.is_over
                            ? `over by ${formatMoney(String(Math.abs(left)))}`
                            : `${formatMoney(String(left))} left`}
                        </p>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Spending by category</CardTitle>
                <span className="text-xs text-muted-foreground">type=expense</span>
              </CardHeader>
              <CardContent className="grid gap-3">
                {breakdown.isPending ? (
                  <LoadingState label="Loading breakdown…" />
                ) : (breakdown.data ?? []).length === 0 ? (
                  <EmptyState
                    title="No spending this month"
                    description="Expenses you record will show up here by category."
                  />
                ) : (
                  <>
                    {(breakdown.data ?? []).slice(0, 5).map((row) => {
                      const width = maxTotal > 0 ? (Number(row.total) / maxTotal) * 100 : 0;
                      return (
                        <div key={row.category_id ?? row.category_name} className="grid grid-cols-[6rem_1fr_auto] items-center gap-2 text-sm">
                          <span className="truncate font-medium">{row.category_name}</span>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                          </div>
                          <Money amount={row.total} className="text-muted-foreground" />
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted-foreground">
                      DB aggregation · no per-category N+1
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent transactions</CardTitle>
              <Button variant="link" size="sm" className="h-auto p-0" asChild>
                <Link to={ROUTES.transactions}>View all →</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recent.isPending ? (
                <LoadingState label="Loading transactions…" />
              ) : recentRows.length === 0 ? (
                <EmptyState
                  title={`No transactions in ${label}`}
                  description="Record your first income or expense to get started."
                  action={
                    <Button variant="outline" asChild>
                      <Link to={ROUTES.transactions}>Add transaction</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="hidden sm:table-cell">Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentRows.map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell className="whitespace-nowrap">{txn.date}</TableCell>
                          <TableCell>
                            <Badge variant={txn.type === "income" ? "secondary" : "outline"}>{txn.type}</Badge>
                          </TableCell>
                          <TableCell>{categoryName.get(txn.category) ?? `#${txn.category}`}</TableCell>
                          <TableCell className="hidden max-w-56 truncate sm:table-cell 2xl:max-w-md">
                            {txn.description || <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${txn.type === "income" ? "text-green-600" : "text-red-600"}`}>
                            {txn.type === "income" ? "+" : "−"}
                            <Money amount={txn.amount} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
