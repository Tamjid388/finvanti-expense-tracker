import { useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TypeSegmented } from "@/components/shared/TypeSegmented";
import type { Category, CategoryInput, TxnType } from "@/types/api";

/** Create/edit form. Same name across types is allowed; duplicates per type are blocked. */
export function CategoryForm({
  initial,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Category | null;
  pending: boolean;
  error: unknown;
  onSubmit: (payload: CategoryInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<TxnType>(initial?.type ?? "expense");
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setLocalError("Give the category a name.");
      return;
    }
    setLocalError(null);
    onSubmit({ name: name.trim(), type });
  }

  const fieldError =
    error instanceof ApiError && error.fieldErrors
      ? ((): string | null => {
          const raw = error.fieldErrors.name ?? error.fieldErrors.type;
          if (Array.isArray(raw)) return raw.join(" ");
          return typeof raw === "string" ? raw : null;
        })()
      : null;
  const generalError =
    localError ??
    (error instanceof ApiError && !error.fieldErrors ? error.message : null) ??
    (error && !(error instanceof ApiError) ? "Couldn't save the category. Please try again." : null);

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              placeholder="e.g. Groceries"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {fieldError ? <p className="text-sm text-destructive">{fieldError}</p> : null}
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Type</span>
            <TypeSegmented value={type} onChange={setType} aria-label="Category type" />
            <p className="text-xs text-muted-foreground">
              Transactions in this category must be {type} too.
            </p>
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
              {pending ? "Saving…" : initial ? "Save changes" : "Create category"}
            </Button>
          </div>
    </form>
  );
}
