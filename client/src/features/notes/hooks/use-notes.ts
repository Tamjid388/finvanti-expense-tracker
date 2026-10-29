import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { notesApi } from "@/api/notes";
import { qk } from "@/api/query-keys";
import type { NoteInput, NoteUpdate } from "@/types/api";

/** All user notes — plain ordered array, no params. */
export function useNotes() {
  return useQuery({
    queryKey: qk.notes(),
    queryFn: () => notesApi.list(),
  });
}

export function useCreateNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: NoteInput) => notesApi.create(payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.notes() }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: NoteUpdate }) =>
      notesApi.update(id, payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.notes() }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => notesApi.destroy(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.notes() }),
  });
}
