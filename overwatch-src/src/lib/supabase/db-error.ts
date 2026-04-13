import { toast } from "sonner";

/**
 * Log a DB read error with optional toast notification.
 * Use this instead of silently returning empty arrays.
 */
export function logDbReadError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[DB] ${context}:`, message);

  // Only toast in browser (not during SSR/build)
  if (typeof window !== "undefined") {
    toast.error(`Failed to load ${context}`, {
      description: "Please try refreshing the page.",
      duration: 5000,
    });
  }
}
