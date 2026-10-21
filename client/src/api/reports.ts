import { api, type QueryParams } from "@/api/client";
import type {
  BudgetStatusItem,
  CategoryBreakdownItem,
  MonthlySummary,
  TxnType,
} from "@/types/api";

const BASE = "/api/reports";

/**
 * Report reads are read-only aggregates. `?month=YYYY-MM` uses inclusive
 * calendar dates; an empty month yields zero totals/success — not an error.
 */
export const reportsApi = {
  /** GET /api/reports/monthly-summary/?month=YYYY-MM */
  monthlySummary: (month?: string) =>
    api.get<MonthlySummary>(`${BASE}/monthly-summary/`, monthParams(month)),

  /** GET /api/reports/category-breakdown/?month=YYYY-MM&type=expense */
  categoryBreakdown: (month?: string, type?: TxnType) => {
    const params: QueryParams = {};
    if (month) params.month = month;
    if (type) params.type = type;
    return api.get<CategoryBreakdownItem[]>(`${BASE}/category-breakdown/`, params);
  },

  /** GET /api/reports/budget-status/?month=YYYY-MM */
  budgetStatus: (month?: string) =>
    api.get<BudgetStatusItem[]>(`${BASE}/budget-status/`, monthParams(month)),
};

function monthParams(month?: string): QueryParams | undefined {
  return month ? { month } : undefined;
}
