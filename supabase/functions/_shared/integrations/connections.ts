/**
 * Connection storage helpers (service-role client only). Secrets live in
 * Vault via the vault_* RPC wrappers from PR #63 (_shared/email/vault.ts).
 */
import { readVaultSecret, writeVaultSecret } from "../email/vault.ts";
import { MAX_REFRESH_FAILURES, refreshDue } from "./backoff.ts";
import { safeError } from "./redact.ts";
import type { AdapterCtx, ConnectionRow, LiveConnection, TokenSet, VendorAdapter } from "./types.ts";

// deno-lint-ignore no-explicit-any -- supabase-js client from the caller (service role)
type Db = any;

export const CONNECTION_COLUMNS =
  "id, company_id, provider, status, auth_type, vault_secret_id, access_expires_at, external_account_id, external_account_name, settings, refresh_failures";

export const vaultName = (companyId: string, provider: string) => `integration-conn:${companyId}:${provider}`;

export async function getConnection(db: Db, companyId: string, provider: string): Promise<ConnectionRow | null> {
  const { data, error } = await db.from("integration_connections").select(CONNECTION_COLUMNS)
    .eq("company_id", companyId).eq("provider", provider).maybeSingle();
  if (error) throw error;
  return data as ConnectionRow | null;
}

export async function loadLive(db: Db, row: ConnectionRow): Promise<LiveConnection> {
  const secrets = row.vault_secret_id ? (await readVaultSecret(db, row.vault_secret_id)) as TokenSet : {};
  return { ...row, secrets };
}

/** Upsert the connection and write secrets to Vault (merge with existing). */
export async function saveConnection(db: Db, p: {
  companyId: string; provider: string; authType: ConnectionRow["auth_type"]; status: ConnectionRow["status"];
  secrets?: TokenSet; externalAccountId?: string | null; externalAccountName?: string | null; connectedBy?: string | null;
}): Promise<ConnectionRow> {
  const existing = await getConnection(db, p.companyId, p.provider);
  let vaultId = existing?.vault_secret_id ?? null;
  let expiresAt = existing?.access_expires_at ?? null;
  if (p.secrets) {
    const prev = vaultId ? await readVaultSecret(db, vaultId).catch(() => ({})) : {};
    vaultId = await writeVaultSecret(db, vaultName(p.companyId, p.provider), { ...prev, ...p.secrets }, vaultId ?? undefined);
    expiresAt = (p.secrets.expires_at as string | null | undefined) ?? null;
  }
  const row = {
    company_id: p.companyId, provider: p.provider, auth_type: p.authType, status: p.status,
    vault_secret_id: vaultId, access_expires_at: expiresAt, refresh_failures: 0, last_error: null,
    ...(p.externalAccountId !== undefined ? { external_account_id: p.externalAccountId } : {}),
    ...(p.externalAccountName !== undefined ? { external_account_name: p.externalAccountName } : {}),
    ...(p.connectedBy !== undefined ? { connected_by: p.connectedBy } : {}),
  };
  const { data, error } = await db.from("integration_connections").upsert(row, { onConflict: "company_id,provider" })
    .select(CONNECTION_COLUMNS).single();
  if (error) throw error;
  return data as ConnectionRow;
}

/** Disconnect: wipe the Vault payload (keeps the id so nothing dangles), clear tokens. */
export async function clearConnection(db: Db, row: ConnectionRow, status: "disconnected" | "revoked" = "disconnected"): Promise<void> {
  if (row.vault_secret_id) await writeVaultSecret(db, vaultName(row.company_id, row.provider), {}, row.vault_secret_id);
  const { error } = await db.from("integration_connections").update({
    status, access_expires_at: null, external_account_id: null, external_account_name: null, refresh_failures: 0,
  }).eq("id", row.id);
  if (error) throw error;
}

export type RefreshResult = "refreshed" | "not_due" | "locked" | "failed" | "no_refresh";

/**
 * Refresh under a per-connection lease so single-use refresh tokens (Gusto)
 * are never spent twice. Re-reads the secret AFTER taking the lock, because
 * another worker may have rotated it a moment ago.
 */
export async function refreshConnection(db: Db, adapter: VendorAdapter, row: ConnectionRow, ctx: AdapterCtx, force = false): Promise<RefreshResult> {
  if (!adapter.refresh) return "no_refresh";
  if (!force && !refreshDue(row.access_expires_at, ctx.now())) return "not_due";
  const { data: token, error: lockErr } = await db.rpc("integration_acquire_refresh_lock", { p_connection_id: row.id, p_ttl_seconds: 60 });
  if (lockErr) throw lockErr;
  if (!token) return "locked";
  try {
    const fresh = await db.from("integration_connections").select(CONNECTION_COLUMNS).eq("id", row.id).single();
    const current = fresh.data as ConnectionRow;
    if (!force && !refreshDue(current.access_expires_at, ctx.now())) return "not_due";
    const live = await loadLive(db, current);
    try {
      const next = await adapter.refresh(live.secrets, ctx);
      await writeVaultSecret(db, vaultName(current.company_id, current.provider), next, current.vault_secret_id ?? undefined);
      await db.from("integration_connections").update({
        access_expires_at: next.expires_at ?? null, refresh_failures: 0, last_error: null,
        ...(current.status === "error" ? { status: "connected" } : {}),
      }).eq("id", current.id);
      return "refreshed";
    } catch (e) {
      const failures = (current.refresh_failures ?? 0) + 1;
      await db.from("integration_connections").update({
        refresh_failures: failures, last_error: `Token refresh failed: ${safeError(e)}`,
        ...(failures >= MAX_REFRESH_FAILURES ? { status: "error" } : {}),
      }).eq("id", current.id);
      return "failed";
    }
  } finally {
    await db.rpc("integration_release_refresh_lock", { p_connection_id: row.id, p_token: token });
  }
}

/** Get a usable connection, refreshing first if the token is (nearly) expired. */
export async function withFreshToken(db: Db, adapter: VendorAdapter, row: ConnectionRow, ctx: AdapterCtx): Promise<LiveConnection> {
  if (adapter.refresh && refreshDue(row.access_expires_at, ctx.now(), 2 * 60_000)) {
    const r = await refreshConnection(db, adapter, row, ctx, true);
    if (r === "locked") await new Promise((res) => setTimeout(res, 1500));
    const again = await getConnection(db, row.company_id, row.provider);
    if (again) return loadLive(db, again);
  }
  return loadLive(db, row);
}
