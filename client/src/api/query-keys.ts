import type { QueryParams } from "@/api/client";
import type { BudgetFilters, TransactionFilters, TxnType } from "@/types/api";

/**
 * Central query-key factory (ARCHITECTURE.md §6). Mutations invalidate by the
 * array prefixes below — keep the literal prefix strings in sync with callers.
 */
export const qk = {
  me: () => ["auth", "me"] as const,

  categories: (params?: QueryParams) => ["categories", params ?? null] as const,

  notes: () => ["notes"] as const,

  transactions: (filters: TransactionFilters = {}) => ["transactions", filters] as const,

  budgets: (filters: BudgetFilters = {}) => ["budgets", filters] as const,

  monthlySummary: (month?: string) => ["reports", "monthly-summary", month ?? null] as const,

  categoryBreakdown: (month?: string, type?: TxnType) =>
    ["reports", "category-breakdown", month ?? null, type ?? null] as const,

  budgetStatus: (month?: string) => ["reports", "budget-status", month ?? null] as const,
};
