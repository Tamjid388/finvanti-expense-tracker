import { api } from "@/api/client";
import type { Budget, BudgetFilters, BudgetInput, Paginated } from "@/types/api";

const BASE = "/api/budgets";

export const budgetsApi = {
  /** GET /api/budgets/?month=YYYY-MM&category_id= */
  list: (filters: BudgetFilters = {}) => api.get<Paginated<Budget>>(`${BASE}/`, filters),

  /** GET /api/budgets/{id}/ */
  retrieve: (id: number) => api.get<Budget>(`${BASE}/${id}/`),

  /** POST /api/budgets/ → 201. Unique per (user, month, category) — 400 on duplicate. */
  create: (payload: BudgetInput) => api.post<Budget>(`${BASE}/`, payload),

  /** PATCH /api/budgets/{id}/ */
  update: (id: number, payload: Partial<BudgetInput>) =>
    api.patch<Budget>(`${BASE}/${id}/`, payload),

  /** DELETE /api/budgets/{id}/ → 204. Never deletes transactions (server rule). */
  destroy: (id: number) => api.del<void>(`${BASE}/${id}/`),
};
