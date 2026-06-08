/**
 * SMS provider factory.
 *
 * Resolves a company's integrations_config.sms row + vault secret into a
 * concrete SmsProvider. Falls back to PlatformProvider if the company has
 * no row, no verified row, or no vault secret.
 *
 * Caller (Edge Function) supplies a service-role Supabase client because
 * vault.decrypted_secrets requires service-role access.
 */

import { TwilioProvider } from "./twilio-provider.ts";
import { PlatformProvider } from "./platform-provider.ts";
import { readVaultSecret } from "./vault.ts";
import type { PlatformConfig, SmsProvider, TwilioConfig } from "./types.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export interface CompanySmsConfig {
  delivery_method: "twilio" | "platform" | null;
  from_number: string | null;
  verified_at: string | null;
  vault_secret_id: string | null;
  is_active: boolean | null;
}

export interface FactoryResult {
  provider: SmsProvider;
  /** Sender E.164 the caller should use unless explicitly overridden. */
  defaultFrom: string;
  /** Tells the caller whether we ended up using the platform fallback. */
  usedFallback: boolean;
}

/**
 * Loads the company's SMS config and constructs an SmsProvider.
 *
 * Rules:
 *   - If the row's delivery_method is "twilio" AND verified_at IS NOT NULL
 *     AND vault_secret_id is set → use TwilioProvider with vault creds.
 *   - Otherwise → use PlatformProvider with the platform's TWILIO_* env vars.
 */
export async function resolveSmsProviderForCompany(
  supabaseService: SupabaseClient,
  companyId: string,
): Promise<FactoryResult> {
  const platformAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
  const platformAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
  const platformFromNumber = Deno.env.get("TWILIO_FROM_NUMBER") ?? "";

  const platformConfig: PlatformConfig = {
    accountSid: platformAccountSid,
    authToken: platformAuthToken,
    platformFromNumber,
  };

  const fallback = (): FactoryResult => ({
    provider: new PlatformProvider(platformConfig),
    defaultFrom: platformFromNumber,
    usedFallback: true,
  });

  if (!platformAccountSid || !platformAuthToken || !platformFromNumber) {
    // eslint-disable-next-line no-console -- platform misconfig is a deploy-time problem
    console.warn(
      "[sms/factory] TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER env vars missing",
    );
  }

  const { data: row, error } = await supabaseService
    .from("integrations_config")
    .select("delivery_method, from_number, verified_at, vault_secret_id, is_active")
    .eq("company_id", companyId)
    .eq("provider", "sms")
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console -- needed for production debugging
    console.warn("[sms/factory] integrations_config read failed:", error.message);
    return fallback();
  }
  if (!row || !row.is_active || !row.verified_at || row.delivery_method !== "twilio") {
    return fallback();
  }

  const cfg = row as CompanySmsConfig;
  if (!cfg.vault_secret_id) return fallback();

  let secret: Record<string, unknown>;
  try {
    secret = await readVaultSecret(supabaseService, cfg.vault_secret_id);
  } catch (e) {
    // eslint-disable-next-line no-console -- needed for production debugging
    console.warn("[sms/factory] vault read failed:", e instanceof Error ? e.message : e);
    return fallback();
  }

  const twilioCfg = secret as unknown as TwilioConfig;
  if (!twilioCfg.accountSid || !twilioCfg.authToken) {
    return fallback();
  }

  const defaultFrom = cfg.from_number ?? twilioCfg.from ?? platformFromNumber;
  return {
    provider: new TwilioProvider({ ...twilioCfg, from: defaultFrom }),
    defaultFrom,
    usedFallback: false,
  };
}
