/**
 * Platform SMS provider — Overwatch's TWILIO_* env credentials.
 *
 * Used as the fallback sender when a company hasn't configured its own
 * Twilio account in the integrations_config + Vault. Reuses the TwilioProvider
 * implementation under the hood; the only difference is the credential
 * source and that it always overrides `From` with the platform number.
 */

import { TwilioProvider } from "./twilio-provider.ts";
import type { PlatformConfig, SendResult, SmsMessage, SmsProvider } from "./types.ts";

export class PlatformProvider implements SmsProvider {
  readonly kind = "platform" as const;
  private twilio: TwilioProvider;
  private platformFromNumber: string;

  constructor(cfg: PlatformConfig) {
    this.twilio = new TwilioProvider({
      accountSid: cfg.accountSid,
      authToken: cfg.authToken,
      from: cfg.platformFromNumber,
    });
    this.platformFromNumber = cfg.platformFromNumber;
  }

  send(message: SmsMessage): Promise<SendResult> {
    return this.twilio.send({ ...message, from: this.platformFromNumber });
  }

  testConnection(): Promise<{ ok: boolean; error?: string }> {
    return this.twilio.testConnection();
  }
}
