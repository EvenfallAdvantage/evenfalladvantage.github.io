import { createClient } from "@/lib/supabase/client";

interface ErrorPayload {
  level: "error" | "warning" | "info";
  message: string;
  stack?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

// Debounce: don't flood the DB with duplicate errors
const recentErrors = new Set<string>();
const DEDUP_WINDOW = 10000; // 10 seconds

/**
 * Log an error to the Supabase error_logs table.
 * Called by the global error handler and React error boundary.
 */
export async function trackError(payload: ErrorPayload) {
  // Deduplicate identical errors within the window
  const key = `${payload.message}:${payload.stack?.slice(0, 100)}`;
  if (recentErrors.has(key)) return;
  recentErrors.add(key);
  setTimeout(() => recentErrors.delete(key), DEDUP_WINDOW);

  try {
    const supabase = createClient();

    // Get user context if available (don't block on auth)
    let userId: string | null = null;
    let companyId: string | null = null;
    try {
      // Read from auth store if available in window (scoped — no PII)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = (window as any).__OVERWATCH_AUTH_STORE__;
      if (store) {
        userId = store.userId ?? null;
        companyId = store.activeCompanyId ?? null;
      }
    } catch { /* ignore */ }

    await supabase.from("error_logs").insert({
      company_id: companyId,
      user_id: userId,
      level: payload.level,
      message: payload.message.slice(0, 2000), // truncate long messages
      stack: payload.stack?.slice(0, 5000) ?? null,
      url: payload.url ?? (typeof window !== "undefined" ? window.location.href : null),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      metadata: payload.metadata ?? {},
    });
  } catch {
    // Silently fail — don't cause errors from the error handler
    console.warn("[ErrorTracker] Failed to log error to database");
  }
}

/**
 * Install global error handlers.
 * Call once in the app root (e.g., in a provider component).
 */
export function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;

  // Unhandled JS errors
  window.addEventListener("error", (event) => {
    trackError({
      level: "error",
      message: event.message || "Unhandled error",
      stack: event.error?.stack,
      url: event.filename,
      metadata: { lineno: event.lineno, colno: event.colno },
    });
  });

  // Unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    trackError({
      level: "error",
      message: reason?.message || String(reason) || "Unhandled promise rejection",
      stack: reason?.stack,
      metadata: { type: "unhandledrejection" },
    });
  });
}

/**
 * Get error logs for a company (admin view).
 */
export async function getErrorLogs(companyId: string, limit = 50) {
  const supabase = createClient();
  const { data } = await supabase
    .from("error_logs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
