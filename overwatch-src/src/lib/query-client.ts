import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient instance for the app.
 *
 * Exported so that company-switch logic and realtime handlers can
 * invalidate/remove queries without going through React context.
 */
let _queryClient: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (!_queryClient) {
    _queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60_000,          // 1 minute before refetch
          gcTime: 5 * 60_000,         // 5 minutes before garbage collection
          refetchOnWindowFocus: false, // don't refetch on tab switch
          retry: 1,                   // one retry on failure
        },
      },
    });
  }
  return _queryClient;
}

/**
 * Invalidate all queries scoped to a specific company.
 * Call on company switch to ensure fresh data.
 */
export function invalidateCompanyQueries(companyId: string) {
  getQueryClient().removeQueries({
    predicate: (query) => {
      const key = query.queryKey;
      // Convention: queries are keyed as [resource, companyId, ...rest]
      return Array.isArray(key) && key[1] === companyId;
    },
  });
}

/**
 * Clear ALL queries — used on logout.
 */
export function clearAllQueries() {
  getQueryClient().clear();
}
