import { api, type QueryParams } from "@/api/client";
import type {
  BudgetStatusItem,
  CategoryBreakdownItem,
  MonthlySummary,
  TxnType,
} from "@/types/api";

const BASE = "/api/reports";

// Read-only aggregates. Empty month yields zeros, not an error.
export const reportsApi = {
  monthlySummary: (month?: string) =>
    api.get<MonthlySummary>(`${BASE}/monthly-summary/`, monthParams(month)),
  categoryBreakdown: (month?: string, type?: TxnType) => {
    const params: QueryParams = {};
    if (month) params.month = month;
    if (type) params.type = type;
    return api.get<CategoryBreakdownItem[]>(`${BASE}/category-breakdown/`, params);
  },
  budgetStatus: (month?: string) =>
    api.get<BudgetStatusItem[]>(`${BASE}/budget-status/`, monthParams(month)),
};

function monthParams(month?: string): QueryParams | undefined {
  return month ? { month } : undefined;
}
