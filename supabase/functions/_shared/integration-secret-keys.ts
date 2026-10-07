/**
 * Which integrations_config.config keys are SECRETS (moved to Vault, never
 * returned to the browser). Pure module, shared by Edge Functions and the
 * Overwatch app tests. Keep in sync with the SQL list in
 * overwatch-src/supabase/migrations/20261007190000_integrations_config_lockdown.sql.
 */
export const SECRET_KEYS = [
  "api_key",
  "access_token",
  "auth_token",
  "rest_api_key",
  "webhook_secret",
  "secret_key",
  "client_secret",
  "refresh_token",
  "password",
] as const;

const SECRET_SET = new Set<string>(SECRET_KEYS);
export const isSecretKey = (k: string) => SECRET_SET.has(k);

/** Providers whose credentials can be saved via integration-save-credentials. */
export const GENERIC_PROVIDERS = new Set([
  "airtable", "whatsapp", "fillout", "checkr", "docusign", "gusto", "quickbooks", "adp", "paychex", "onesignal",
]);

/** Split a submitted config into public fields and secret fields (empty secrets dropped = keep existing). */
export function splitConfig(config: Record<string, unknown>): { publicConfig: Record<string, string>; secrets: Record<string, string> } {
  const publicConfig: Record<string, string> = {};
  const secrets: Record<string, string> = {};
  for (const [k, v] of Object.entries(config ?? {})) {
    if (typeof v !== "string") continue;
    if (k === "secret_keys_set") continue;
    if (isSecretKey(k)) { if (v.trim()) secrets[k] = v.trim(); }
    else publicConfig[k] = v.trim();
  }
  return { publicConfig, secrets };
}

/** Remove secret values from a config object (for anything returned to a browser). */
export function redactConfig(config: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config ?? {})) if (!isSecretKey(k)) out[k] = v;
  return out;
}
