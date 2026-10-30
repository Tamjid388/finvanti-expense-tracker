import { useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TypeSegmented } from "@/components/shared/TypeSegmented";
import type { Category, Transaction, TransactionInput, TxnType } from "@/types/api";

function fieldMessage(error: unknown, field: string): string | null {
  if (error instanceof ApiError && error.fieldErrors) {
    const raw = error.fieldErrors[field];
    if (Array.isArray(raw)) return raw.join(" ");
    if (typeof raw === "string") return raw;
  }
  return null;
}

/** Create/edit form. Category options always match the selected txn type (PRD §9). */
export function TransactionForm({
  categories,
  initial,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  categories: Category[];
  initial?: Transaction | null;
  pending: boolean;
  error: unknown;
  onSubmit: (payload: TransactionInput) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<TxnType>(initial?.type ?? "expense");
  const [category, setCategory] = useState<string>(initial ? String(initial.category) : "");
  const [amount, setAmount] = useState<string>(initial?.amount ?? "");
  const [date, setDate] = useState<string>(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState<string>(initial?.description ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  const options = categories.filter((c) => c.type === type);
  // If the type changed under a selected category, force a re-pick.
  const categoryValid = options.some((c) => String(c.id) === category);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedAmount = amount.trim();
    if (!categoryValid) {
      setLocalError("Choose a category for this type.");
      return;
    }
    const parsed = Number(trimmedAmount);
    if (!trimmedAmount || !Number.isFinite(parsed) || parsed <= 0) {
      setLocalError("Amount must be greater than zero.");
      return;
    }
    if (!date) {
      setLocalError("Choose a date.");
      return;
    }
    setLocalError(null);
    onSubmit({
      type,
      category: Number(category),
      amount: trimmedAmount,
      date,
      description: description.trim(),
    });
  }

  const generalError =
    localError ??
    (error instanceof ApiError && !error.fieldErrors ? error.message : null) ??
    (error && !(error instanceof ApiError) ? "Couldn't save the transaction. Please try again." : null);

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Type</span>
            <TypeSegmented
              value={type}
              onChange={(next) => {
                setType(next);
              }}
              aria-label="Transaction type"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="txn-category">Category</Label>
            <Select value={categoryValid ? category : ""} onValueChange={setCategory}>
              <SelectTrigger id="txn-category" aria-label="Category">
                <SelectValue placeholder={`Choose an ${type} category`} />
              </SelectTrigger>
              <SelectContent>
                {options.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No {type} categories yet — create one first
                  </SelectItem>
                ) : (
                  options.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {fieldMessage(error, "category") ? (
              <p className="text-sm text-destructive">{fieldMessage(error, "category")}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="txn-amount">Amount (BDT)</Label>
              <Input
                id="txn-amount"
                inputMode="decimal"
                placeholder="0.00"
                autoComplete="off"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {fieldMessage(error, "amount") ? (
                <p className="text-sm text-destructive">{fieldMessage(error, "amount")}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="txn-date">Date</Label>
              <Input
                id="txn-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {fieldMessage(error, "date") ? (
                <p className="text-sm text-destructive">{fieldMessage(error, "date")}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="txn-description">Description (optional)</Label>
            <Input
              id="txn-description"
              placeholder="e.g. Lunch at Shad's"
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {fieldMessage(error, "description") ? (
              <p className="text-sm text-destructive">{fieldMessage(error, "description")}</p>
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
              {pending ? "Saving…" : initial ? "Save changes" : "Save transaction"}
            </Button>
          </div>
    </form>
  );
}
