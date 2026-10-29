import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { toast } from "@/components/shared/Toaster";
import type { Note } from "@/types/api";

import { useCreateNote, useDeleteNote, useNotes, useUpdateNote } from "../hooks/use-notes";
import { NoteForm } from "../components/NoteForm";

function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return "Couldn't load notes. Please try again.";
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

/** Notes screen: header, form dialog, card list, delete confirm. */
export function NotesPage() {
  const [params] = useSearchParams();
  const [showForm, setShowForm] = useState(() => params.get("new") === "1");
  const [editing, setEditing] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState<Note | null>(null);

  useEffect(() => {
    if (params.get("new") === "1") {
      formReset();
      setEditing(null);
      setShowForm(true);
    }
    // Open-once deep link from the topbar quick-add.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const list = useNotes();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  function formReset() {
    createNote.reset();
    updateNote.reset();
  }

  const notes = list.data ?? [];

  function openCreate() {
    setEditing(null);
    formReset();
    setShowForm(true);
  }

  function openEdit(note: Note) {
    setEditing(note);
    formReset();
    setShowForm(true);
  }

  const formError = editing ? updateNote.error : createNote.error;
  const formPending = editing ? updateNote.isPending : createNote.isPending;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Notes</h1>
          <p className="text-sm text-muted-foreground">Title required · description optional</p>
        </div>
        <Button onClick={() => (showForm && !editing ? setShowForm(false) : openCreate())}>
          <Plus className="size-4" aria-hidden />
          {showForm && !editing ? "Close form" : "New note"}
        </Button>
      </header>

      {showForm ? (
        <NoteForm
          key={editing?.id ?? "new"}
          initial={editing}
          pending={formPending}
          error={formError}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSubmit={(payload) => {
            if (editing) {
              updateNote.mutate(
                { id: editing.id, payload },
                {
                  onSuccess: () => {
                    setShowForm(false);
                    setEditing(null);
                    toast("Note saved");
                  },
                },
              );
            } else {
              createNote.mutate(payload, {
                onSuccess: () => {
                  setShowForm(false);
                  toast("Note created");
                },
              });
            }
          }}
        />
      ) : null}

      {list.isPending ? (
        <LoadingState label="Loading notes…" />
      ) : list.isError ? (
        <ErrorState
          title="Couldn't load notes"
          description={friendlyError(list.error)}
          onRetry={() => void list.refetch()}
        />
      ) : notes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Jot down anything you want to remember."
          action={
            <Button variant="outline" onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              Add note
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {notes.map((note) => (
            <Card
              key={note.id}
              className="group transition-shadow hover:shadow-md"
            >
              <CardContent className="flex flex-col gap-3 pt-6">
                <div className="min-w-0 space-y-1.5">
                  <h3 className="truncate text-base font-semibold tracking-tight">
                    {note.title}
                  </h3>
                  {note.description ? (
                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
                      {note.description}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground/70 italic">No description</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Created {formatTimestamp(note.created_at)} · Updated{" "}
                    {formatTimestamp(note.updated_at)}
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      aria-label={`Edit ${note.title}`}
                      onClick={() => openEdit(note)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      aria-label={`Delete ${note.title}`}
                      onClick={() => {
                        deleteNote.reset();
                        setDeleting(note);
                      }}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete note?"
        description={deleting ? `“${deleting.title}” will be removed.` : undefined}
        confirmLabel={deleteNote.isPending ? "Deleting…" : "Delete"}
        onConfirm={() => {
          if (!deleting) return;
          deleteNote.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null);
              toast("Note deleted");
            },
          });
        }}
      />
      {deleteNote.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {deleteNote.error instanceof ApiError
            ? deleteNote.error.message
            : "Couldn't delete the note."}
        </p>
      ) : null}
    </div>
  );
}
