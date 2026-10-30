import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialog } from "@/components/shared/FormDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { TypeSegmented } from "@/components/shared/TypeSegmented";
import { toast } from "@/components/shared/Toaster";
import type { Category, TxnType } from "@/types/api";

import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from "../hooks/use-categories";
import { CategoryForm } from "../components/CategoryForm";

function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return error.message;
    return error.message;
  }
  return "Couldn't load categories. Please try again.";
}

/** Wireframe emoji per category name — falls back to a type-colored initial. */
function categoryEmoji(name: string): string | null {
  const n = name.toLowerCase();
  if (/food|grocer|dining|restaurant|lunch|dinner|eat/.test(n)) return "🍔";
  if (/transport|bus|uber|taxi|commute|fuel|car|rickshaw/.test(n)) return "🚌";
  if (/rent|house|home|apartment/.test(n)) return "🏠";
  if (/shop|cloth|mall|purchase/.test(n)) return "🛍";
  if (/util|electric|water|gas|internet|phone|bill/.test(n)) return "💡";
  if (/health|medic|doctor|pharma|hospital/.test(n)) return "🏥";
  if (/salary|wage|pay|income/.test(n)) return "💼";
  if (/freelance|gig|contract/.test(n)) return "💻";
  if (/allowance|gift|bonus|pocket/.test(n)) return "🎁";
  if (/travel|trip|flight|hotel/.test(n)) return "✈️";
  if (/education|school|course|book|tuition/.test(n)) return "📚";
  if (/entertain|movie|game|fun|sport/.test(n)) return "🎬";
  return null;
}

/** Wireframe categories screen: type filter, card grid, add/edit/delete. */
export function CategoriesPage() {
  const [params] = useSearchParams();
  const [type, setType] = useState<TxnType | null>(null);
  const [showForm, setShowForm] = useState(() => params.get("new") === "1");
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  useEffect(() => {
    if (params.get("new") === "1") {
      createTxnReset();
      setEditing(null);
      setShowForm(true);
    }
    // Open-once deep link from the topbar quick-add.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const list = useCategories();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();
  function createTxnReset() {
    createCat.reset();
    updateCat.reset();
  }

  const all = list.data ?? [];
  const incomeCount = all.filter((c) => c.type === "income").length;
  const expenseCount = all.filter((c) => c.type === "expense").length;
  const visible = all.filter((c) => type === null || c.type === type);
  const income = visible.filter((c) => c.type === "income");
  const expense = visible.filter((c) => c.type === "expense");

  function openCreate() {
    setEditing(null);
    createTxnReset();
    setShowForm(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    createTxnReset();
    setShowForm(true);
  }

  const formError = editing ? updateCat.error : createCat.error;
  const formPending = editing ? updateCat.isPending : createCat.isPending;

  function renderGroup(title: string, rows: Category[]) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {title} ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories here yet.</p>
          ) : (
            rows.map((category) => {
              const emoji = categoryEmoji(category.name);
              return (
                <div
                  key={category.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-base ${
                        category.type === "income" ? "bg-green-100" : "bg-red-100"
                      }`}
                      aria-hidden
                    >
                      {emoji ?? category.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="truncate font-medium">{category.name}</span>
                    <Badge variant={category.type === "income" ? "secondary" : "outline"}>
                      {category.type}
                    </Badge>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${category.name}`} onClick={() => openEdit(category)}>
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${category.name}`}
                      onClick={() => {
                        deleteCat.reset();
                        setDeleting(category);
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Type must match transaction type · duplicates blocked per user+type
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          New category
        </Button>
      </header>

      <FormDialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowForm(false);
            setEditing(null);
          }
        }}
        title={editing ? "Edit category" : "Add category"}
      >
        <CategoryForm
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
              updateCat.mutate(
                { id: editing.id, payload },
                {
                  onSuccess: () => {
                    setShowForm(false);
                    setEditing(null);
                    toast("Category saved");
                  },
                },
              );
            } else {
              createCat.mutate(payload, {
                onSuccess: () => {
                  setShowForm(false);
                  toast("Category created");
                },
              });
            }
          }}
        />
      </FormDialog>

      <div className="flex flex-wrap items-center gap-3">
        <TypeSegmented
          value={type}
          onChange={setType}
          showAll
          onSelectAll={() => setType(null)}
        />
        <span className="text-sm text-muted-foreground" aria-live="polite">
          All ({all.length}) · Income ({incomeCount}) · Expense ({expenseCount})
        </span>
      </div>

      {list.isPending ? (
        <LoadingState label="Loading categories…" />
      ) : list.isError ? (
        <ErrorState
          title="Couldn't load categories"
          description={friendlyError(list.error)}
          onRetry={() => void list.refetch()}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Create one to start organizing transactions."
          action={
            <Button variant="outline" onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              Add category
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {renderGroup("Income categories", income)}
          {renderGroup("Expense categories", expense)}
        </div>
      )}

      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <CardContent className="pt-6 text-sm">
          <strong>Deletion note:</strong> categories with past transactions stay in your
          history and can&apos;t be deleted until their transactions are removed.
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete category?"
        description={
          deleting
            ? `“${deleting.name}” will be removed. Categories with transactions can't be deleted — remove or move those transactions first.`
            : undefined
        }
        confirmLabel={deleteCat.isPending ? "Deleting…" : "Delete"}
        onConfirm={() => {
          if (!deleting) return;
          deleteCat.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null);
              toast("Category deleted");
            },
          });
        }}
      />
      {deleteCat.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {deleteCat.error instanceof ApiError
            ? deleteCat.error.message
            : "Couldn't delete the category."}
        </p>
      ) : null}
    </div>
  );
}
