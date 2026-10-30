import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useQueries } from "@tanstack/react-query";

import { ApiError } from "@/api/client";
import { qk } from "@/api/query-keys";
import { transactionsApi } from "@/api/transactions";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialog } from "@/components/shared/FormDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Money } from "@/components/shared/Money";
import { TypeSegmented } from "@/components/shared/TypeSegmented";
import { toast } from "@/components/shared/Toaster";
import { currentMonth, monthBounds } from "@/lib/dates";
import type { Transaction, TxnType } from "@/types/api";
import { useCategories } from "@/features/categories/hooks/use-categories";

import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
} from "../hooks/use-transactions";
import { TransactionForm } from "../components/TransactionForm";

function friendlyListError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return error.message;
    if (error.status === 400) return "Those filters aren't valid. Adjust the dates or type and try again.";
    return error.message;
  }
  return "Couldn't load transactions. Please try again.";
}

/** Wireframe transactions screen: filters, table, pagination, add/edit/delete. */
export function TransactionsPage() {
  const [params] = useSearchParams();
  const paramQ = (params.get("q") ?? "").trim();
  const [type, setType] = useState<TxnType | null>(null);
  const [categoryId, setCategoryId] = useState<string>("");
  const defaultBounds = monthBounds(currentMonth());
  const [startDate, setStartDate] = useState(defaultBounds.start);
  const [endDate, setEndDate] = useState(defaultBounds.end);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(() => params.get("new") === "1");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  useEffect(() => {
    if (params.get("new") === "1") {
      createReset();
      setEditing(null);
      setShowForm(true);
    }
    // Open-once deep link from the topbar quick-add.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const categoriesQuery = useCategories();
  const categories = categoriesQuery.data ?? [];
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const categoryChoices = categories.filter((c) => type === null || c.type === type);
  const categoryValid = categoryId === "" || categoryChoices.some((c) => String(c.id) === categoryId);

  const rangeError =
    startDate && endDate && startDate > endDate ? "Start date must be on or before end date." : null;

  const searching = paramQ.length > 0;
  const filters = {
    ...(type ? { type } : {}),
    ...(categoryValid && categoryId ? { category_id: Number(categoryId) } : {}),
    ...(startDate ? { start_date: startDate } : {}),
    ...(endDate ? { end_date: endDate } : {}),
    page,
  };

  const list = useTransactions(rangeError ? { page: 1 } : filters);
  const createTxn = useCreateTransaction();
  const updateTxn = useUpdateTransaction();
  const deleteTxn = useDeleteTransaction();
  function createReset() {
    createTxn.reset();
    updateTxn.reset();
  }

  // Wireframe global search: match description + category across every page.
  const count = list.data?.count ?? 0;
  const extraPages =
    searching && !rangeError && !list.isPending && count > 20
      ? Array.from({ length: Math.ceil(count / 20) - 1 }, (_, i) => i + 2)
      : [];
  const extra = useQueries({
    queries: extraPages.map((p) => ({
      queryKey: qk.transactions({ ...filters, page: p }),
      queryFn: () => transactionsApi.list({ ...filters, page: p }),
    })),
  });
  const searchingPending = list.isPending || extra.some((q) => q.isPending);
  const searchingFailed = list.isError || extra.some((q) => q.isError);
  const searchError = list.error ?? extra.find((q) => q.error)?.error;
  const allRows = searching
    ? [
        ...(list.data?.results ?? []),
        ...extra.flatMap((q) => q.data?.results ?? []),
      ].filter((txn) =>
        `${txn.description ?? ""} ${categoryName.get(txn.category) ?? ""}`
          .toLowerCase()
          .includes(paramQ.toLowerCase()),
      )
    : [];

  const rows = searching ? allRows : (rangeError ? [] : (list.data?.results ?? []));
  const shownCount = searching ? rows.length : count;

  function resetFilters() {
    setType(null);
    setCategoryId("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    toast("Filters cleared");
  }

  function openCreate() {
    setEditing(null);
    createReset();
    setShowForm(true);
  }

  function openEdit(txn: Transaction) {
    setEditing(txn);
    createReset();
    setShowForm(true);
  }

  const formError = editing ? updateTxn.error : createTxn.error;
  const formPending = editing ? updateTxn.isPending : createTxn.isPending;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Transactions</h1>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          Add transaction
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
        title={editing ? "Edit transaction" : "Add transaction"}
      >
        <TransactionForm
          key={editing?.id ?? "new"}
          categories={categories}
          initial={editing}
          pending={formPending}
          error={formError}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSubmit={(payload) => {
            if (editing) {
              updateTxn.mutate(
                { id: editing.id, payload },
                {
                  onSuccess: () => {
                    setShowForm(false);
                    setEditing(null);
                    toast("Saved — dashboard & budgets recalculated");
                  },
                },
              );
            } else {
              createTxn.mutate(payload, {
                onSuccess: () => {
                  setShowForm(false);
                  setPage(1);
                  toast("Saved — dashboard & budgets recalculated");
                },
              });
            }
          }}
        />
      </FormDialog>

      <Card>
        <CardContent className="grid gap-3 pt-6">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <TypeSegmented
                value={type}
                onChange={(next) => {
                  setType(next);
                  setPage(1);
                }}
                showAll
                onSelectAll={() => {
                  setType(null);
                  setPage(1);
                }}
              />
              <div className="grid gap-1">
                <Label htmlFor="f-category" className="sr-only">
                  Filter by category
                </Label>
                <Select
                  value={categoryValid ? categoryId || "__all" : "__all"}
                  onValueChange={(value) => {
                    setCategoryId(value === "__all" ? "" : value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="f-category" className="w-48" aria-label="Filter by category">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">All categories</SelectItem>
                    {categoryChoices.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name} ({c.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <Label htmlFor="f-start">Start date</Label>
                <Input
                  id="f-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <span className="pb-2 text-muted-foreground" aria-hidden>
                →
              </span>
              <div className="grid gap-1">
                <Label htmlFor="f-end">End date</Label>
                <Input
                  id="f-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <Button
                variant="outline"
                onClick={resetFilters}
                title="Clear all filters"
              >
                <RotateCcw className="size-4" aria-hidden />
                Reset
              </Button>
            </div>
          </div>
          {rangeError ? <p className="text-sm text-destructive">{rangeError}</p> : null}
          {searching ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Search: “{paramQ}” across every page — clear the topbar search to go back.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {rangeError ? (
        <EmptyState title="Fix the date range" description={rangeError} />
      ) : searching ? (
        searchingPending ? (
          <LoadingState label={`Searching for “${paramQ}”…`} />
        ) : searchingFailed ? (
          <ErrorState
            title="Search failed"
            description={searchError instanceof ApiError ? searchError.message : "Please try again."}
            onRetry={() => void list.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title={`No matches for “${paramQ}”`}
            description="Try a different description or category name."
          />
        ) : (
          renderTable()
        )
      ) : list.isPending ? (
        <LoadingState label="Loading transactions…" />
      ) : list.isError ? (
        <ErrorState
          title="Couldn't load transactions"
          description={friendlyListError(list.error)}
          onRetry={() => void list.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No transactions found"
          description="Try widening the date range or clearing filters."
          action={
            <Button variant="outline" onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              Add transaction
            </Button>
          }
        />
      ) : (
        renderTable()
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete transaction?"
        description={
          deleting
            ? `“${deleting.description || categoryName.get(deleting.category) || "Transaction"} — ${deleting.date}” will be removed. Summaries & budgets recalculate instantly.`
            : undefined
        }
        confirmLabel={deleteTxn.isPending ? "Deleting…" : "Delete"}
        onConfirm={() => {
          if (!deleting) return;
          deleteTxn.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null);
              toast("Transaction deleted — reports updated");
            },
          });
        }}
      />
      {deleteTxn.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {deleteTxn.error instanceof ApiError ? deleteTxn.error.message : "Couldn't delete the transaction."}
        </p>
      ) : null}
    </div>
  );

  function renderTable() {
    return (
      <>
        <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="hidden min-w-64 sm:table-cell">Description</TableHead>
                <TableHead className="text-right">Amount (BDT)</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="whitespace-nowrap">{txn.date}</TableCell>
                  <TableCell>
                    <Badge variant={txn.type === "income" ? "secondary" : "outline"}>{txn.type}</Badge>
                  </TableCell>
                  <TableCell>{categoryName.get(txn.category) ?? `#${txn.category}`}</TableCell>
                  <TableCell className="hidden max-w-64 truncate sm:table-cell 2xl:max-w-md">
                    {txn.description || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${txn.type === "income" ? "text-green-600" : "text-red-600"}`}>
                    {txn.type === "income" ? "+" : "−"}
                    <Money amount={txn.amount} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Edit transaction ${txn.id}`} onClick={() => openEdit(txn)}>
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete transaction ${txn.id}`}
                        onClick={() => setDeleting(txn)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="grid gap-3 md:hidden">
          {rows.map((txn) => (
            <div key={txn.id} className="grid gap-2 rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{txn.date}</span>
                <Badge variant={txn.type === "income" ? "secondary" : "outline"}>{txn.type}</Badge>
                <span className={`ml-auto text-right font-medium ${txn.type === "income" ? "text-green-600" : "text-red-600"}`}>
                  {txn.type === "income" ? "+" : "−"}
                  <Money amount={txn.amount} />
                </span>
              </div>
              <div className="flex items-baseline gap-2 text-sm">
                <span className="min-w-0 max-w-[55%] truncate font-medium">{categoryName.get(txn.category) ?? `#${txn.category}`}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {txn.description || "—"}
                </span>
              </div>
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" aria-label={`Edit transaction ${txn.id}`} onClick={() => openEdit(txn)}>
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete transaction ${txn.id}`}
                  onClick={() => setDeleting(txn)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span aria-live="polite">
            {searching
              ? `${shownCount} match${shownCount === 1 ? "" : "es"} · ${count} total`
              : `${rows.length} of ${count}`}
          </span>
          {searching ? null : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!list.data?.previous || list.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                ‹ Prev
              </Button>
              <Button variant="outline" size="sm" disabled={!list.data?.next || list.isFetching} onClick={() => setPage((p) => p + 1)}>
                Next ›
              </Button>
            </div>
          )}
        </div>
      </>
    );
  }
}
