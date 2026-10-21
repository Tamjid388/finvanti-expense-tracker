import { QueryClient } from "@tanstack/react-query";

/**
 * App-wide TanStack Query client.
 * - Empty months/zero results are SUCCESS states, never errors (PRD §12).
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export { queryClient };
