/**
 * Audit logging helper for Edge Functions.
 *
 * Mirrors overwatch-src/src/lib/security/audit.ts but uses the service-role
 * Supabase client so it can insert into audit_logs from server-side code
 * regardless of caller. Writes are best-effort — never throws.
 *
 * Schema (effective columns after add-security-audit.sql migration):
 *   company_id   (NOT NULL, FK)
 *   user_id      (FK, nullable)
 *   action       (NOT NULL)            — equals event_type
 *   entity_type  (NOT NULL)            — "auth" for invite/login flows
 *   entity_id    (text; production rejects an explicit null, SQLSTATE 23502.
 *                 Pass the integration connection id. Do not send null.)
 *   metadata     (jsonb)
 *   event_type   (text)                — mirror of action
 *   outcome      ('success'|'failure'|'blocked')
 *   ip_address   (text, nullable)
 *   user_agent   (text, nullable)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js client type
type SupabaseClient = any;

export interface AuditEntry {
  event_type: string;
  company_id: string;
  user_id?: string | null;
  entity_id?: string | null;
  entity_type?: string;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown>;
  outcome: "success" | "failure" | "blocked";
}

export async function logAudit(
  supabaseService: SupabaseClient,
  entry: AuditEntry,
): Promise<void> {
  try {
    if (!entry.company_id) return;
    const entityId = typeof entry.entity_id === "string" ? entry.entity_id.trim().slice(0, 200) : "";
    const row: Record<string, unknown> = {
      action: entry.event_type,
      entity_type: entry.entity_type ?? "auth",
      event_type: entry.event_type,
      user_id: entry.user_id ?? null,
      company_id: entry.company_id,
      ip_address: entry.ip_address ?? null,
      user_agent: entry.user_agent ?? null,
      metadata: entry.metadata ?? {},
      outcome: entry.outcome,
    };
    // An explicit null violates the production NOT NULL check. Omit the column
    // only when the caller has no id; integration actions always pass the
    // connection id, which stays after disconnect (the row is updated, not deleted).
    if (entityId) row.entity_id = entityId;
    const { error } = await supabaseService.from("audit_logs").insert(row);
    if (error) {
      console.warn("[audit] write failed:", error.message ? String(error.message).slice(0, 180) : "insert failed");
    }
    return;
  } catch (err) {
    // eslint-disable-next-line no-console -- audit must never break the request path
    console.warn(
      "[audit] write failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

/** Extract caller IP from the request headers behind Supabase's edge proxy. */
export function getCallerIp(req: Request): string | null {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

export function getCallerUserAgent(req: Request): string | null {
  return req.headers.get("user-agent") ?? null;
}
