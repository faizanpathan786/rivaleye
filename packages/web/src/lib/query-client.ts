import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const QUERY_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutes
      // gcTime must be >= the persisted maxAge, otherwise inactive queries are
      // dropped from memory before they can be re-hydrated on the next load.
      gcTime: QUERY_CACHE_MAX_AGE,
      refetchOnWindowFocus: false,
      retry: 0,
      throwOnError: false,
    },
  },
});

export const queryPersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "rivaleye-query-cache",
});

// Call on sign-out so the next account can't see the previous user's data.
export async function clearQueryCache() {
  queryClient.clear();
  await queryPersister.removeClient();
}
