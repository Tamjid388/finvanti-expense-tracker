import { useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currentMonth } from "@/lib/dates";
import type { Budget, BudgetInput, Category } from "@/types/api";

function fieldMessage(error: unknown, field: string): string | null {
  if (error instanceof ApiError && error.fieldErrors) {
    const raw = error.fieldErrors[field];
    if (Array.isArray(raw)) return raw.join(" ");
    if (typeof raw === "string") return raw;
  }
  return null;
}

/** Create/edit form. Month goes out as `YYYY-MM`; category empty = overall budget. */
export function BudgetForm({
  categories,
  defaultMonth,
  initial,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  categories: Category[];
  defaultMonth: string;
  initial?: Budget | null;
  pending: boolean;
  error: unknown;
  onSubmit: (payload: BudgetInput) => void;
  onCancel: () => void;
}) {
  const initialMonth =
    initial?.month && initial.month.length >= 7 ? initial.month.slice(0, 7) : defaultMonth;
  const [month, setMonth] = useState(initialMonth || currentMonth());
  const [category, setCategory] = useState<string>(
    initial ? (initial.category == null ? "__overall" : String(initial.category)) : "__overall",
  );
  const [limit, setLimit] = useState<string>(initial?.limit_amount ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  const expenseCategories = categories.filter((c) => c.type === "expense");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      setLocalError("Choose a valid month.");
      return;
    }
    const parsed = Number(limit.trim());
    if (!limit.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setLocalError("Limit must be greater than zero.");
      return;
    }
    setLocalError(null);
    onSubmit({
      month,
      category: category === "__overall" ? null : Number(category),
      limit_amount: limit.trim(),
    });
  }

  const generalError =
    localError ??
    fieldMessage(error, "non_field_errors") ??
    (error instanceof ApiError && !error.fieldErrors ? error.message : null) ??
    (error && !(error instanceof ApiError) ? "Couldn't save the budget. Please try again." : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{initial ? "Edit budget" : "Add budget"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="budget-month">Month</Label>
              <Input
                id="budget-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
              {fieldMessage(error, "month") ? (
                <p className="text-sm text-destructive">{fieldMessage(error, "month")}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="budget-limit">Limit (BDT)</Label>
              <Input
                id="budget-limit"
                inputMode="decimal"
                placeholder="0.00"
                autoComplete="off"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
              {fieldMessage(error, "limit_amount") ? (
                <p className="text-sm text-destructive">{fieldMessage(error, "limit_amount")}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="budget-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="budget-category" aria-label="Budget category">
                <SelectValue placeholder="Overall — all expenses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__overall">Overall — all expenses</SelectItem>
                {expenseCategories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only expense categories can have budgets. Empty scope = overall budget.
            </p>
            {fieldMessage(error, "category") ? (
              <p className="text-sm text-destructive">{fieldMessage(error, "category")}</p>
            ) : null}
          </div>

          {generalError ? (
            <p role="alert" className="text-sm text-destructive">
              {generalError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : initial ? "Save changes" : "Create budget"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
