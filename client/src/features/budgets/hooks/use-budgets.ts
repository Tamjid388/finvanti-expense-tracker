import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { budgetsApi } from "@/api/budgets";
import { qk } from "@/api/query-keys";
import type { BudgetFilters, BudgetInput } from "@/types/api";

/** Month-scoped budgets — `?month=YYYY-MM` comes from the screen's month param. */
export function useBudgets(filters: BudgetFilters = {}) {
  return useQuery({
    queryKey: qk.budgets(filters),
    queryFn: () => budgetsApi.list(filters),
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: BudgetInput) => budgetsApi.create(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["budgets"] });
      void qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<BudgetInput> }) =>
      budgetsApi.update(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["budgets"] });
      void qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => budgetsApi.destroy(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["budgets"] });
      void qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}
