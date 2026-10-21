import { api } from "@/api/client";
import type { Paginated, Transaction, TransactionFilters, TransactionInput, TransactionUpdate } from "@/types/api";

const BASE = "/api/transactions";

export const transactionsApi = {
  list: (filters: TransactionFilters = {}) => api.get<Paginated<Transaction>>(`${BASE}/`, filters),
  retrieve: (id: number) => api.get<Transaction>(`${BASE}/${id}/`),
  // Category type must match txn type (PRD §9).
  create: (payload: TransactionInput) => api.post<Transaction>(`${BASE}/`, payload),
  update: (id: number, payload: TransactionUpdate) =>
    api.patch<Transaction>(`${BASE}/${id}/`, payload),
  // 204. Confirm in UI before calling.
  destroy: (id: number) => api.del<void>(`${BASE}/${id}/`),
};
