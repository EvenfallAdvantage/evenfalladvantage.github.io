/** Strip sensitive fields from webhook payloads before they are stored. */
const SENSITIVE = /(ssn|social|dob|birth|token|secret|password|signature|account_number|routing|tax_id|tin|license_number)/i;

export function redactPayload(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[depth]";
  if (Array.isArray(value)) return value.slice(0, 200).map((v) => redactPayload(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) ? "[redacted]" : redactPayload(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 2000) return value.slice(0, 2000) + "…";
  return value;
}

/** Error text safe for last_error / audit (no bearer tokens, keys, emails). */
export function safeError(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  return m
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]")
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .slice(0, 300);
}
