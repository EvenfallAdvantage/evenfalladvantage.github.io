/**
 * Platform provider — fallback when a company hasn't configured its own
 * email integration (or its integration is not yet verified).
 *
 * Uses Overwatch's own RESEND_API_KEY env var. The From address is always
 * `invite@evenfalladvantage.com` (or `noreply@`) and the display name is
 * rewritten to `"{Company} via Overwatch"` so recipients see the company
 * brand even when delivery is platform-relayed.
 *
 * Reply-To is honored verbatim from the caller so replies still go to the
 * inviting/sending admin.
 */

import { ResendProvider } from "./resend-provider.ts";
import type {
  EmailMessage,
  EmailProvider,
  PlatformConfig,
  SendResult,
} from "./types.ts";

export class PlatformProvider implements EmailProvider {
  readonly kind = "platform" as const;
  private readonly inner: ResendProvider;

  constructor(private readonly config: PlatformConfig) {
    this.inner = new ResendProvider({ apiKey: config.apiKey });
  }

  send(message: EmailMessage): Promise<SendResult> {
    const rebrandedFromName = message.from.name
      ? `${message.from.name} via Overwatch`
      : "Overwatch";
    const rewritten: EmailMessage = {
      ...message,
      from: {
        email: this.config.platformFromEmail,
        name: rebrandedFromName,
      },
    };
    return this.inner.send(rewritten);
  }

  /** Trivially-true — the platform key is set as a function secret by the operator. */
  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    return this.inner.testConnection();
  }
}
