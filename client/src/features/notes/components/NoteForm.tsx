import { useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Note, NoteInput } from "@/types/api";

function pickField(fieldErrors: unknown, key: string): string | null {
  if (typeof fieldErrors !== "object" || fieldErrors === null) return null;
  const raw = (fieldErrors as Record<string, unknown>)[key];
  if (Array.isArray(raw)) return raw.join(" ");
  return typeof raw === "string" ? raw : null;
}

/** Create/edit form: title required (max 200), description optional multiline. */
export function NoteForm({
  initial,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Note | null;
  pending: boolean;
  error: unknown;
  onSubmit: (payload: NoteInput) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setLocalError("Give the note a title.");
      return;
    }
    setLocalError(null);
    onSubmit({ title: title.trim(), description: description.trim() });
  }

  const titleError =
    error instanceof ApiError ? pickField(error.fieldErrors, "title") : null;
  const descriptionError =
    error instanceof ApiError ? pickField(error.fieldErrors, "description") : null;
  const generalError =
    localError ??
    (error instanceof ApiError && !error.fieldErrors ? error.message : null) ??
    (error && !(error instanceof ApiError) ? "Couldn't save the note. Please try again." : null);

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="note-title">Title</Label>
            <Input
              id="note-title"
              placeholder="e.g. Grocery ideas"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={titleError ? true : undefined}
            />
            {titleError ? <p className="text-sm text-destructive">{titleError}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="note-description">Description</Label>
            <textarea
              id="note-description"
              placeholder="Optional details…"
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-invalid={descriptionError ? true : undefined}
              className={cn(
                "min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
              )}
            />
            {descriptionError ? (
              <p className="text-sm text-destructive">{descriptionError}</p>
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
              {pending ? "Saving…" : initial ? "Save changes" : "Create note"}
            </Button>
          </div>
    </form>
  );
}
