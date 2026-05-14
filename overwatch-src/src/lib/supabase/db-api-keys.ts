import { createClient } from "./client";

// ─── Types ───────────────────────────────────────────────

export type ApiKeyRow = {
  id: string;
  company_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_by: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

export type CreatedApiKey = {
  row: ApiKeyRow;
  /** Plaintext key — shown ONCE at creation, never retrievable again. */
  plaintext: string;
};

const KEY_PREFIX = "ova_live_";

/* ─── Crypto helpers ──────────────────────────────────── */

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomKeyBody(): string {
  // 32 random bytes → 64 hex chars. Cryptographically strong.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Build a fresh API key in the form `ova_live_<64 hex chars>`. */
function generatePlaintextKey(): string {
  return `${KEY_PREFIX}${randomKeyBody()}`;
}

function buildKeyPrefix(plaintext: string): string {
  // First 12 chars of plaintext (covers prefix + 3-4 entropy chars), for display.
  // Plaintext format is "ova_live_XXXXXXXX..." → "ova_live_XXX"
  return plaintext.slice(0, 12);
}

/* ─── CRUD ────────────────────────────────────────────── */

export async function createApiKey(params: {
  companyId: string;
  createdBy: string;
  name: string;
  scopes?: string[];
  expiresAt?: string | null;
}): Promise<CreatedApiKey> {
  const supabase = createClient();
  const plaintext = generatePlaintextKey();
  const key_hash = await sha256Hex(plaintext);
  const key_prefix = buildKeyPrefix(plaintext);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      company_id: params.companyId,
      name: params.name,
      key_prefix,
      key_hash,
      scopes: params.scopes ?? ["intake:write"],
      created_by: params.createdBy,
      expires_at: params.expiresAt ?? null,
    })
    .select("id, company_id, name, key_prefix, scopes, created_by, created_at, last_used_at, expires_at, revoked_at")
    .single();

  if (error || !data) throw error ?? new Error("Failed to create API key");

  return { row: data as ApiKeyRow, plaintext };
}

export async function listApiKeys(companyId: string): Promise<ApiKeyRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, company_id, name, key_prefix, scopes, created_by, created_at, last_used_at, expires_at, revoked_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApiKeyRow[];
}

export async function revokeApiKey(keyId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId);
  if (error) throw error;
}

export async function deleteApiKey(keyId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("id", keyId);
  if (error) throw error;
}

/* ─── Usage stats ─────────────────────────────────────── */

export type ApiKeyUsage = {
  total_requests_24h: number;
  successful_24h: number;
  rate_limited_24h: number;
  last_request_at: string | null;
};

export async function getApiKeyUsage(keyId: string): Promise<ApiKeyUsage> {
  const supabase = createClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("api_request_log")
    .select("status_code, created_at")
    .eq("api_key_id", keyId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  type LogRow = { status_code: number; created_at: string };
  const rows: LogRow[] = (data ?? []) as LogRow[];
  const successful = rows.filter((r: LogRow) => r.status_code >= 200 && r.status_code < 300).length;
  const rate_limited = rows.filter((r: LogRow) => r.status_code === 429).length;
  const last = rows[0]?.created_at ?? null;

  return {
    total_requests_24h: rows.length,
    successful_24h: successful,
    rate_limited_24h: rate_limited,
    last_request_at: last,
  };
}

/* ─── Helpers exposed for testing ─────────────────────── */

export const __internal = {
  sha256Hex,
  generatePlaintextKey,
  buildKeyPrefix,
};
