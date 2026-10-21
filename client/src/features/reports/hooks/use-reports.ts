import { useQuery } from "@tanstack/react-query";

import { qk } from "@/api/query-keys";
import { reportsApi } from "@/api/reports";
import type { TxnType } from "@/types/api";

/** GET /api/reports/monthly-summary/?month= — zeros for empty months, never errors. */
export function useMonthlySummary(month?: string) {
  return useQuery({
    queryKey: qk.monthlySummary(month),
    queryFn: () => reportsApi.monthlySummary(month),
  });
}

export function useCategoryBreakdown(month?: string, type?: TxnType) {
  return useQuery({
    queryKey: qk.categoryBreakdown(month, type),
    queryFn: () => reportsApi.categoryBreakdown(month, type),
  });
}

export function useBudgetStatus(month?: string) {
  return useQuery({
    queryKey: qk.budgetStatus(month),
    queryFn: () => reportsApi.budgetStatus(month),
  });
}
