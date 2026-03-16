/**
 * Audit Logging — NIST 800-171 §3.3 (Audit & Accountability)
 *
 * Logs all security-relevant events to the audit_logs table in Supabase.
 * Captures: who, what, when, where (IP/UA), and outcome.
 */

import { createClient } from "@/lib/supabase/client";
import type { SecurityEventType } from "./index";

export interface AuditEntry {
  event_type: SecurityEventType;
  user_id?: string;
  company_id?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
  outcome: "success" | "failure" | "blocked";
}

/**
 * Log a security event to the audit_logs table.
 * Fails silently to avoid breaking the app on logging errors.
 */
export async function logSecurityEvent(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.from("audit_logs").insert({
      event_type: entry.event_type,
      user_id: entry.user_id || null,
      company_id: entry.company_id || null,
      ip_address: entry.ip_address || null,
      user_agent: entry.user_agent || (typeof navigator !== "undefined" ? navigator.userAgent : null),
      metadata: entry.metadata || {},
      outcome: entry.outcome,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Audit logging should never crash the app
    console.warn("[Overwatch Security] Audit log write failed");
  }
}

/**
 * Get recent audit events for a company (admin view).
 */
export async function getAuditLogs(
  companyId: string,
  options: { limit?: number; offset?: number; eventType?: string } = {}
) {
  const supabase = createClient();
  let query = supabase
    .from("audit_logs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(options.limit || 50);

  if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  if (options.eventType) query = query.eq("event_type", options.eventType);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Get security stats for the dashboard.
 */
export async function getSecurityStats(companyId: string) {
  try {
    const supabase = createClient();
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [recentEvents, failedLogins, lockouts] = await Promise.all([
      supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("created_at", last24h),
      supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("event_type", "auth.login.failed")
        .gte("created_at", last7d),
      supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("event_type", "security.lockout")
        .gte("created_at", last7d),
    ]);

    return {
      events24h: recentEvents.count ?? 0,
      failedLogins7d: failedLogins.count ?? 0,
      lockouts7d: lockouts.count ?? 0,
    };
  } catch {
    return { events24h: 0, failedLogins7d: 0, lockouts7d: 0 };
  }
}

/**
 * Track login attempts for brute-force protection.
 * Returns { allowed: boolean, attemptsRemaining: number }
 */
export async function checkLoginAttempts(
  identifier: string,
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000
): Promise<{ allowed: boolean; attemptsRemaining: number }> {
  const key = `login_attempts_${identifier}`;
  const stored = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(key) : null;

  if (stored) {
    const data = JSON.parse(stored) as { count: number; firstAttempt: number };
    const elapsed = Date.now() - data.firstAttempt;

    if (elapsed > windowMs) {
      // Window expired, reset
      sessionStorage.removeItem(key);
      return { allowed: true, attemptsRemaining: maxAttempts };
    }

    if (data.count >= maxAttempts) {
      return { allowed: false, attemptsRemaining: 0 };
    }

    return { allowed: true, attemptsRemaining: maxAttempts - data.count };
  }

  return { allowed: true, attemptsRemaining: maxAttempts };
}

/**
 * Record a failed login attempt.
 */
export function recordFailedAttempt(identifier: string): void {
  if (typeof sessionStorage === "undefined") return;
  const key = `login_attempts_${identifier}`;
  const stored = sessionStorage.getItem(key);

  if (stored) {
    const data = JSON.parse(stored) as { count: number; firstAttempt: number };
    data.count++;
    sessionStorage.setItem(key, JSON.stringify(data));
  } else {
    sessionStorage.setItem(key, JSON.stringify({ count: 1, firstAttempt: Date.now() }));
  }
}

/**
 * Clear login attempts after successful login.
 */
export function clearLoginAttempts(identifier: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(`login_attempts_${identifier}`);
}
