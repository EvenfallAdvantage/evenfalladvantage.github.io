import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Convenience wrapper for company-scoped queries.
 *
 * Automatically disables the query when no company is active,
 * and keys it by [resource, companyId, ...extra] so invalidation
 * on company switch works.
 *
 * Usage:
 * ```ts
 * const { data: events, isLoading } = useCompanyQuery(
 *   "events",
 *   (companyId) => getEvents(companyId),
 * );
 * ```
 */
export function useCompanyQuery<T>(
  resource: string,
  queryFn: (companyId: string) => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error, T, [string, string, ...string[]]>, "queryKey" | "queryFn" | "enabled"> & {
    extraKeys?: string[];
    enabled?: boolean;
  }
) {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);

  return useQuery<T, Error, T, [string, string, ...string[]]>({
    queryKey: [resource, activeCompanyId ?? "", ...(options?.extraKeys ?? [])] as [string, string, ...string[]],
    queryFn: () => queryFn(activeCompanyId!),
    enabled: !!activeCompanyId && (options?.enabled !== false),
    ...options,
  });
}
