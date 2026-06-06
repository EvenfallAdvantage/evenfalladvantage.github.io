/**
 * Supabase Vault helpers for per-company email provider credentials.
 *
 * Convention:
 *   - Each company's email config row points at a vault secret via
 *     integrations_config.config.vault_secret_id (uuid).
 *   - The secret itself is a JSON blob whose shape depends on provider:
 *       smtp:   { host, port, username, password, secure }
 *       resend: { apiKey }
 *   - The caller (Edge Function) uses the service-role client to read
 *     vault.decrypted_secrets. RLS is service-role-only by design.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js client type from caller's scope
type SupabaseClient = any;

export async function readVaultSecret(
  supabaseService: SupabaseClient,
  secretId: string,
): Promise<Record<string, unknown>> {
  // We use the public.vault_read_secret() SECURITY DEFINER wrapper rather
  // than exposing the vault schema through PostgREST. The wrapper is
  // service-role-only (see sql/add_vault_rpc_wrappers.sql).
  const { data, error } = await supabaseService.rpc("vault_read_secret", {
    p_id: secretId,
  });
  if (error) {
    throw new Error(`Vault read failed for secret ${secretId}: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Vault secret ${secretId} is empty or not found`);
  }
  try {
    return JSON.parse(String(data)) as Record<string, unknown>;
  } catch (e) {
    throw new Error(
      `Vault secret ${secretId} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Create or replace a vault secret with the given JSON payload.
 * Returns the secret's uuid for storage in integrations_config.
 */
export async function writeVaultSecret(
  supabaseService: SupabaseClient,
  name: string,
  payload: Record<string, unknown>,
  existingId?: string,
): Promise<string> {
  const serialized = JSON.stringify(payload);
  if (existingId) {
    const { error } = await supabaseService.rpc("vault_update_secret", {
      p_id: existingId,
      p_secret: serialized,
      p_name: name,
      p_description: null,
    });
    if (error) {
      throw new Error(`Vault update failed: ${error.message}`);
    }
    return existingId;
  }
  const { data, error } = await supabaseService.rpc("vault_create_secret", {
    p_secret: serialized,
    p_name: name,
    p_description: "",
  });
  if (error || !data) {
    throw new Error(`Vault create failed: ${error?.message ?? "no id returned"}`);
  }
  return String(data);
}
