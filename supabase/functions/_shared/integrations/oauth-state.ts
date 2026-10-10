/** OAuth state validation (pure). */
export interface OAuthStateRow {
  state: string; company_id: string; provider: string; user_id: string | null;
  code_verifier: string | null; redirect_after: string | null; expires_at: string; used_at: string | null;
}

export type StateCheck = { ok: true } | { ok: false; reason: "missing" | "provider_mismatch" | "expired" | "used" };

export function checkState(row: OAuthStateRow | null, provider: string, now: Date): StateCheck {
  if (!row) return { ok: false, reason: "missing" };
  if (row.provider !== provider) return { ok: false, reason: "provider_mismatch" };
  if (row.used_at) return { ok: false, reason: "used" };
  if (Date.parse(row.expires_at) <= now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true };
}
