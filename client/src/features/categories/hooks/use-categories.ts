import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { categoriesApi } from "@/api/categories";
import { qk } from "@/api/query-keys";
import type { CategoryInput } from "@/types/api";

/** All user categories — the txn form filters this list by the selected type. */
export function useCategories() {
  return useQuery({
    queryKey: qk.categories(),
    queryFn: () => categoriesApi.list(),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CategoryInput) => categoriesApi.create(payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CategoryInput> }) =>
      categoriesApi.update(id, payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => categoriesApi.destroy(id),
    onSuccess: () => {
      // Deletion policy (FR-CAT-06) may reassign/remove txns — refresh all.
      void qc.invalidateQueries({ queryKey: ["categories"] });
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      void qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}
