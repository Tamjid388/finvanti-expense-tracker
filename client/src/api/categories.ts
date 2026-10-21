import { api, type QueryParams } from "@/api/client";
import type { Category, CategoryInput, CategoryUpdate } from "@/types/api";

const BASE = "/api/categories";

// Plain array — no pagination on categories.
export const categoriesApi = {
  list: (params?: QueryParams) => api.get<Category[]>(`${BASE}/`, params),
  retrieve: (id: number) => api.get<Category>(`${BASE}/${id}/`),
  create: (payload: CategoryInput) => api.post<Category>(`${BASE}/`, payload),
  update: (id: number, payload: CategoryUpdate) => api.patch<Category>(`${BASE}/${id}/`, payload),
  // 204. Confirm in UI first (FR-CAT-06).
  destroy: (id: number) => api.del<void>(`${BASE}/${id}/`),
};
