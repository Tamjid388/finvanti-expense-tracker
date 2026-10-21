import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qk } from "@/api/query-keys";
import { transactionsApi } from "@/api/transactions";
import type { TransactionFilters, TransactionInput } from "@/types/api";

/** List with wireframe filters (type/category/date-range + pagination). */
export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: qk.transactions(filters),
    queryFn: () => transactionsApi.list(filters),
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: TransactionInput) => transactionsApi.create(payload),
    onSuccess: () => {
      // Txn writes move every rollup: lists, budgets, and reports.
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      void qc.invalidateQueries({ queryKey: ["reports"] });
      void qc.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<TransactionInput> }) =>
      transactionsApi.update(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      void qc.invalidateQueries({ queryKey: ["reports"] });
      void qc.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => transactionsApi.destroy(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      void qc.invalidateQueries({ queryKey: ["reports"] });
      void qc.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}
