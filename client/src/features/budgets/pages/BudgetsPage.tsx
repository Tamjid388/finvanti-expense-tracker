import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialog } from "@/components/shared/FormDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Money } from "@/components/shared/Money";
import { MonthPager } from "@/components/shared/MonthPager";
import { toast } from "@/components/shared/Toaster";
import { useMonthParam } from "@/hooks/use-month-param";
import { useCategories } from "@/features/categories/hooks/use-categories";
import type { Budget } from "@/types/api";

import { useBudgets, useCreateBudget, useDeleteBudget, useUpdateBudget } from "../hooks/use-budgets";
import { BudgetForm } from "../components/BudgetForm";

function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return error.message;
    return error.message;
  }
  return "Couldn't load budgets. Please try again.";
}

function progressTone(percent: number, isOver: boolean): string {
  if (isOver) return "bg-red-500";
  if (percent >= 85) return "bg-amber-500";
  return "bg-emerald-500";
}

/** Wireframe budgets screen: month title, budget cards, remaining math. */
export function BudgetsPage() {
  const { month, label, shiftMonth } = useMonthParam();
  const [params] = useSearchParams();
  const [showForm, setShowForm] = useState(() => params.get("new") === "1");
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);

  useEffect(() => {
    if (params.get("new") === "1") {
      createBudget.reset();
      updateBudget.reset();
      setEditing(null);
      setShowForm(true);
    }
    // Open-once deep link from the topbar quick-add.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const list = useBudgets({ month });
  const categoriesQuery = useCategories();
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();

  const categories = categoriesQuery.data ?? [];
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const budgets = list.data ?? [];

  function openCreate() {
    setEditing(null);
    createBudget.reset();
    updateBudget.reset();
    setShowForm(true);
  }

  function openEdit(budget: Budget) {
    setEditing(budget);
    createBudget.reset();
    updateBudget.reset();
    setShowForm(true);
  }

  const formError = editing ? updateBudget.error : createBudget.error;
  const formPending = editing ? updateBudget.isPending : createBudget.isPending;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Budgets</h1>
          <p className="text-sm text-muted-foreground">
            Unique per user+month+scope · spent derived from expense txns · over-budget never blocks txns
          </p>
        </div>
        <MonthPager label={label} month={month} onShift={shiftMonth} />
      </header>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          New budget
        </Button>
      </div>

      <FormDialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowForm(false);
            setEditing(null);
          }
        }}
        title={editing ? "Edit budget" : "Add budget"}
      >
        <BudgetForm
          key={editing?.id ?? "new"}
          categories={categories}
          defaultMonth={month}
          initial={editing}
          pending={formPending}
          error={formError}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSubmit={(payload) => {
            if (editing) {
              updateBudget.mutate(
                { id: editing.id, payload },
                {
                  onSuccess: () => {
                    setShowForm(false);
                    setEditing(null);
                    toast("Budget saved");
                  },
                },
              );
            } else {
              createBudget.mutate(payload, {
                onSuccess: () => {
                  setShowForm(false);
                  toast("Budget created");
                },
              });
            }
          }}
        />
      </FormDialog>

      {list.isPending ? (
        <LoadingState label="Loading budgets…" />
      ) : list.isError ? (
        <ErrorState
          title="Couldn't load budgets"
          description={friendlyError(list.error)}
          onRetry={() => void list.refetch()}
        />
      ) : budgets.length === 0 ? (
        <EmptyState
          title={`No budgets for ${label}`}
          description="Set a monthly limit — over-budget never blocks recording transactions."
          action={
            <Button variant="outline" onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              Add budget
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {budgets.map((budget) => {
            const spent = Number(budget.spent);
            const limit = Number(budget.limit_amount);
            const percent = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
            const name =
              budget.category == null
                ? "Overall"
                : (categoryName.get(budget.category) ?? `Category #${budget.category}`);
            return (
              <Card key={budget.id} className={budget.is_over ? "border-red-300" : undefined}>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-base">{name}</CardTitle>
                  <Badge variant={budget.is_over ? "destructive" : percent >= 85 ? "secondary" : "outline"}>
                    {budget.is_over ? "Over" : `${Math.round(percent)}%`}
                  </Badge>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <div className="text-sm text-muted-foreground">
                    <Money amount={budget.spent} /> spent of <Money amount={budget.limit_amount} />
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={Math.round(percent)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${name} budget progress`}
                  >
                    <div
                      className={`h-full rounded-full ${progressTone(percent, budget.is_over)}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className={budget.is_over ? "font-medium text-red-600" : "text-muted-foreground"}>
                      Remaining <Money amount={budget.remaining} />
                    </span>
                    <span className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${name} budget`} onClick={() => openEdit(budget)}>
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${name} budget`}
                        onClick={() => {
                          deleteBudget.reset();
                          setDeleting(budget);
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Remaining = limit − spent. Negative remaining means over budget — recording
          transactions is never blocked. Deleting a budget never deletes transactions.
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete budget?"
        description="The budget is removed, but every transaction stays. Reports update immediately."
        confirmLabel={deleteBudget.isPending ? "Deleting…" : "Delete"}
        onConfirm={() => {
          if (!deleting) return;
          deleteBudget.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null);
              toast("Budget deleted — txns kept");
            },
          });
        }}
      />
      {deleteBudget.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {deleteBudget.error instanceof ApiError ? deleteBudget.error.message : "Couldn't delete the budget."}
        </p>
      ) : null}
    </div>
  );
}
