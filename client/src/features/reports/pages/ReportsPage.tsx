import { useState } from "react";

import { ApiError } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Money } from "@/components/shared/Money";
import { MonthPager } from "@/components/shared/MonthPager";
import { TypeSegmented } from "@/components/shared/TypeSegmented";
import { useMonthParam } from "@/hooks/use-month-param";
import { useCategories } from "@/features/categories/hooks/use-categories";
import type { TxnType } from "@/types/api";

import { useBudgetStatus, useCategoryBreakdown, useMonthlySummary } from "../hooks/use-reports";

function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return error.message;
    if (error.status === 400) return "That month isn't valid. Pick a month and try again.";
    return error.message;
  }
  return "Couldn't load reports. Please try again.";
}

/** Wireframe reports screen: monthly summary, category breakdown, budget status. */
export function ReportsPage() {
  const { month, label, shiftMonth } = useMonthParam();
  const [breakdownType, setBreakdownType] = useState<TxnType>("expense");

  const summary = useMonthlySummary(month);
  const breakdown = useCategoryBreakdown(month, breakdownType);
  const budgetStatus = useBudgetStatus(month);
  const categoriesQuery = useCategories();
  const categoryName = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c.name]));

  const failed = summary.isError || breakdown.isError || budgetStatus.isError;
  const failedError = summary.error ?? breakdown.error ?? budgetStatus.error;
  const totals = breakdown.data ?? [];
  const maxTotal = Math.max(0, ...totals.map((row) => Number(row.total)));
  const statusRows = budgetStatus.data ?? [];
  const overCount = statusRows.filter((r) => r.is_over).length;
  const nearCount = statusRows.filter((r) => {
    if (r.is_over || Number(r.limit) <= 0) return false;
    return Number(r.spent) / Number(r.limit) >= 0.85;
  }).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            User-scoped · month boundaries inclusive · empty month returns zeros
          </p>
        </div>
        <MonthPager label={label} month={month} onShift={shiftMonth} />
      </header>

      {failed ? (
        <ErrorState
          title="Couldn't load reports"
          description={friendlyError(failedError)}
          onRetry={() => {
            void summary.refetch();
            void breakdown.refetch();
            void budgetStatus.refetch();
          }}
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly summary — {label}</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.isPending ? (
                <LoadingState label="Loading summary…" />
              ) : summary.data ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="grid gap-1">
                    <span className="text-sm text-muted-foreground">Total income · monthly-summary</span>
                    <span className="text-xl font-semibold text-green-600">
                      <Money amount={summary.data.total_income} />
                    </span>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-sm text-muted-foreground">Total expenses</span>
                    <span className="text-xl font-semibold text-red-600">
                      <Money amount={summary.data.total_expenses} />
                    </span>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-sm text-muted-foreground">Net</span>
                    <span className="text-xl font-semibold">
                      <Money amount={summary.data.net_balance} />
                    </span>
                    <span className="text-xs text-muted-foreground">Monthly net, not lifetime cash.</span>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-sm text-muted-foreground">Budgets over</span>
                    <span className={`text-xl font-semibold ${overCount > 0 ? "text-red-600" : ""}`}>
                      {overCount} of {statusRows.length}
                      {budgetStatus.isPending ? "…" : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {nearCount} near limit
                    </span>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">Category breakdown</CardTitle>
                <TypeSegmented
                  value={breakdownType}
                  onChange={setBreakdownType}
                  aria-label="Breakdown type"
                  className="scale-90"
                />
              </CardHeader>
              <CardContent className="grid gap-3">
                {breakdown.isPending ? (
                  <LoadingState label="Loading breakdown…" />
                ) : totals.length === 0 ? (
                  <EmptyState
                    title={`No ${breakdownType} transactions`}
                    description={`Empty months return zeros, not errors — ${label} has nothing to break down.`}
                  />
                ) : (
                  totals.map((row) => {
                    const width = maxTotal > 0 ? (Number(row.total) / maxTotal) * 100 : 0;
                    return (
                      <div
                        key={row.category_id ?? row.category_name}
                        className="grid grid-cols-[6rem_1fr_auto] items-center gap-2 text-sm"
                      >
                        <span className="truncate font-medium">{row.category_name}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                        </div>
                        <Money amount={row.total} className="text-muted-foreground" />
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Budget status — {label}</CardTitle>
              </CardHeader>
              <CardContent>
                {budgetStatus.isPending ? (
                  <LoadingState label="Loading budget status…" />
                ) : (budgetStatus.data ?? []).length === 0 ? (
                  <EmptyState
                    title="No budgets this month"
                    description="Budget status appears here once you set a limit."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Budget</TableHead>
                          <TableHead className="text-right">Limit</TableHead>
                          <TableHead className="text-right">Spent</TableHead>
                          <TableHead className="text-right">Remaining</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(budgetStatus.data ?? []).map((row) => (
                          <TableRow key={row.budget_id}>
                            <TableCell className="font-medium">
                              {row.category_id == null
                                ? "Overall"
                                : (categoryName.get(row.category_id) ?? `#${row.category_id}`)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Money amount={row.limit} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Money amount={row.spent} />
                            </TableCell>
                            <TableCell className={`text-right ${row.is_over ? "font-medium text-red-600" : ""}`}>
                              <Money amount={row.remaining} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={row.is_over ? "destructive" : "outline"}>
                                {row.is_over ? "Over" : "On track"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-dashed">
            <CardContent className="flex flex-wrap items-center gap-2 pt-6 text-sm text-muted-foreground">
              <span>
                <strong>Empty months show ৳0</strong> — months with no activity display
                zeros and empty lists, never errors.
              </span>
              <Button variant="ghost" onClick={() => shiftMonth(1)}>
                Next month →
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
