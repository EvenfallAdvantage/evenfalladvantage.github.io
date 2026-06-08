/**
 * Vault helpers for SMS provider credentials.
 *
 * The implementation is shared with the email provider (same vault_*
 * SECURITY DEFINER RPC wrappers). This module is a thin alias so callers can
 * import from `_shared/sms/vault.ts` for clarity at the call site.
 *
 * Secret payload shape for Twilio:
 *   { accountSid: string, authToken: string, from: string }
 */

export { readVaultSecret, writeVaultSecret } from "../email/vault.ts";
