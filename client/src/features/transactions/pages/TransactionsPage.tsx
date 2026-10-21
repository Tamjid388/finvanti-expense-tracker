import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlaceholderNotice } from "@/components/shared/PlaceholderNotice";
import { TypeSegmented } from "@/components/shared/TypeSegmented";
import type { TxnType } from "@/types/api";

/** Wireframe transactions screen: type filter, add button, table, pagination. */
export function TransactionsPage() {
  const [type, setType] = useState<TxnType | null>(null);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <p className="text-sm text-muted-foreground">Every income and expense you record.</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TypeSegmented
          value={type}
          onChange={(next) => setType((current) => (current === next ? null : next))}
        />
        <Button size="sm" disabled>
          <Plus className="size-4" aria-hidden />
          Add transaction
        </Button>
      </div>

      <PlaceholderNotice />

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="hidden min-w-64 sm:table-cell">Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[0, 1, 2, 3].map((row) => (
              <TableRow key={row}>
                <TableCell colSpan={5}>
                  <Skeleton className="h-5 w-full" aria-hidden />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
        <Skeleton className="h-8 w-28" aria-hidden />
      </div>
    </div>
  );
}
