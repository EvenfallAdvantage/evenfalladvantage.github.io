/**
 * Email provider factory.
 *
 * Resolves a company's integrations_config.email row + vault secret into a
 * concrete EmailProvider. Falls back to PlatformProvider if the company has
 * no row, no verified row, or no vault secret.
 *
 * Caller (Edge Function) supplies a service-role Supabase client because
 * vault.decrypted_secrets requires service-role access.
 */

import { SmtpProvider } from "./smtp-provider.ts";
import { ResendProvider } from "./resend-provider.ts";
import { PlatformProvider } from "./platform-provider.ts";
import { readVaultSecret } from "./vault.ts";
import type {
  EmailProvider,
  PlatformConfig,
  ResendConfig,
  SmtpConfig,
} from "./types.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export interface CompanyEmailConfig {
  delivery_method: "smtp" | "resend" | "platform" | null;
  from_email: string | null;
  from_name: string | null;
  reply_to: string | null;
  verified_at: string | null;
  vault_secret_id: string | null;
}

export interface FactoryResult {
  provider: EmailProvider;
  /** From-address the caller should use unless explicitly overridden. */
  defaultFrom: { email: string; name?: string };
  /** Optional default Reply-To from the company's saved config. */
  defaultReplyTo?: { email: string };
  /** Tells the caller whether we ended up using the platform fallback. */
  usedFallback: boolean;
}

/**
 * Loads the company's email config and constructs an EmailProvider.
 *
 * Rules:
 *   - If the row's provider is "smtp" or "resend" AND verified_at IS NOT NULL
 *     AND vault_secret_id is set → use that provider with vault-loaded creds.
 *   - Otherwise → use PlatformProvider with company name as the display brand.
 */
export async function resolveProviderForCompany(
  supabaseService: SupabaseClient,
  companyId: string,
  companyName: string,
): Promise<FactoryResult> {
  const platformApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const platformFromEmail =
    Deno.env.get("PLATFORM_FROM_EMAIL") ?? "invite@evenfalladvantage.com";
  const platformFromName = "Overwatch";

  const platformConfig: PlatformConfig = {
    apiKey: platformApiKey,
    platformFromEmail,
    platformFromName,
  };

  const fallback = (): FactoryResult => ({
    provider: new PlatformProvider(platformConfig),
    defaultFrom: { email: platformFromEmail, name: companyName },
    usedFallback: true,
  });

  if (!platformApiKey) {
    // We still build the provider so the caller can surface "no email at all"
    // diagnostics. send() will fail with a Resend HTTP error.
    // eslint-disable-next-line no-console -- platform misconfig is a deploy-time problem
    console.warn("[email/factory] RESEND_API_KEY env var is missing");
  }

  // integrations_config.provider = 'email' is the category/kind. The actual
  // delivery method (smtp / resend) lives in delivery_method (new column,
  // see extend_integrations_config_email.sql migration). Legacy rows stored
  // the delivery method inside config.provider; we ignore those here and
  // fall back to platform until the admin migrates them via the new UI.
  const { data: row, error } = await supabaseService
    .from("integrations_config")
    .select(
      "delivery_method, from_email, from_name, reply_to, verified_at, vault_secret_id, is_active",
    )
    .eq("company_id", companyId)
    .eq("provider", "email")
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console -- needed for production debugging
    console.warn("[email/factory] integrations_config read failed:", error.message);
    return fallback();
  }
  if (!row || !row.is_active || !row.verified_at || !row.delivery_method) {
    return fallback();
  }

  const cfg = row as CompanyEmailConfig & { is_active: boolean };
  if (!cfg.vault_secret_id) return fallback();

  let secret: Record<string, unknown>;
  try {
    secret = await readVaultSecret(supabaseService, cfg.vault_secret_id);
  } catch (e) {
    // eslint-disable-next-line no-console -- needed for production debugging
    console.warn("[email/factory] vault read failed:", e instanceof Error ? e.message : e);
    return fallback();
  }

  const defaultFrom = {
    email: cfg.from_email ?? "",
    name: cfg.from_name ?? companyName,
  };
  const defaultReplyTo = cfg.reply_to ? { email: cfg.reply_to } : undefined;

  if (cfg.delivery_method === "smtp") {
    const smtpCfg = secret as unknown as SmtpConfig;
    if (!smtpCfg.host || !smtpCfg.port || !smtpCfg.username || !smtpCfg.password) {
      return fallback();
    }
    return {
      provider: new SmtpProvider(smtpCfg),
      defaultFrom,
      defaultReplyTo,
      usedFallback: false,
    };
  }
  if (cfg.delivery_method === "resend") {
    const resendCfg = secret as unknown as ResendConfig;
    if (!resendCfg.apiKey) return fallback();
    return {
      provider: new ResendProvider(resendCfg),
      defaultFrom,
      defaultReplyTo,
      usedFallback: false,
    };
  }
  return fallback();
}
