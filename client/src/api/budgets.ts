import { api } from "@/api/client";
import type { Budget, BudgetFilters, BudgetInput, BudgetUpdate } from "@/types/api";

const BASE = "/api/budgets";

// Plain array — no pagination on budgets.
export const budgetsApi = {
  list: (filters: BudgetFilters = {}) => api.get<Budget[]>(`${BASE}/`, filters),
  retrieve: (id: number) => api.get<Budget>(`${BASE}/${id}/`),
  // Unique per (user, month, category) — 400 on duplicate.
  create: (payload: BudgetInput) => api.post<Budget>(`${BASE}/`, payload),
  update: (id: number, payload: BudgetUpdate) => api.patch<Budget>(`${BASE}/${id}/`, payload),
  // 204. Never deletes transactions (server rule).
  destroy: (id: number) => api.del<void>(`${BASE}/${id}/`),
};
