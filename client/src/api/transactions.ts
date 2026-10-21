import { api } from "@/api/client";
import type { Paginated, Transaction, TransactionFilters, TransactionInput } from "@/types/api";

const BASE = "/api/transactions";

export const transactionsApi = {
  /** GET /api/transactions/?type=&category_id=&start_date=&end_date=&page= */
  list: (filters: TransactionFilters = {}) => api.get<Paginated<Transaction>>(`${BASE}/`, filters),

  /** GET /api/transactions/{id}/ */
  retrieve: (id: number) => api.get<Transaction>(`${BASE}/${id}/`),

  /** POST /api/transactions/ → 201. Category type must match txn type (PRD §9). */
  create: (payload: TransactionInput) => api.post<Transaction>(`${BASE}/`, payload),

  /** PATCH /api/transactions/{id}/ */
  update: (id: number, payload: Partial<TransactionInput>) =>
    api.patch<Transaction>(`${BASE}/${id}/`, payload),

  /** DELETE /api/transactions/{id}/ → 204. Confirm in UI before calling. */
  destroy: (id: number) => api.del<void>(`${BASE}/${id}/`),
};
