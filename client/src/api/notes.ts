import { api } from "@/api/client";
import type { Note, NoteInput, NoteUpdate } from "@/types/api";

const BASE = "/api/notes";

// Plain array — no pagination on notes.
export const notesApi = {
  list: () => api.get<Note[]>(`${BASE}/`),
  retrieve: (id: number) => api.get<Note>(`${BASE}/${id}/`),
  create: (payload: NoteInput) => api.post<Note>(`${BASE}/`, payload),
  update: (id: number, payload: NoteUpdate) => api.patch<Note>(`${BASE}/${id}/`, payload),
  // 204. Confirm in UI first.
  destroy: (id: number) => api.del<void>(`${BASE}/${id}/`),
};
