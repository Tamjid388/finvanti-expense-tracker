import { api, type QueryParams } from "@/api/client";
import type { Category, CategoryInput, Paginated } from "@/types/api";

const BASE = "/api/categories";

export const categoriesApi = {
  /** GET /api/categories/ */
  list: (params?: QueryParams) => api.get<Paginated<Category>>(`${BASE}/`, params),

  /** GET /api/categories/{id}/ */
  retrieve: (id: number) => api.get<Category>(`${BASE}/${id}/`),

  /** POST /api/categories/ → 201. Duplicate (user, name, type) is rejected 400. */
  create: (payload: CategoryInput) => api.post<Category>(`${BASE}/`, payload),

  /** PATCH /api/categories/{id}/ */
  update: (id: number, payload: Partial<CategoryInput>) =>
    api.patch<Category>(`${BASE}/${id}/`, payload),

  /** DELETE /api/categories/{id}/ → 204. Deletion policy: confirm first in UI (FR-CAT-06). */
  destroy: (id: number) => api.del<void>(`${BASE}/${id}/`),
};
