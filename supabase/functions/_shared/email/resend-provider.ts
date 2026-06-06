/**
 * Resend provider — calls the Resend HTTPS API directly.
 *
 * Per-company config (when provider="resend"): vault stores the api_key.
 * Platform fallback (provider="platform") uses Overwatch's own RESEND_API_KEY
 * env var — see PlatformProvider.
 */

import type {
  EmailMessage,
  EmailProvider,
  ResendConfig,
  SendResult,
} from "./types.ts";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export class ResendProvider implements EmailProvider {
  readonly kind = "resend" as const;
  constructor(private readonly config: ResendConfig) {}

  async send(message: EmailMessage): Promise<SendResult> {
    const body: Record<string, unknown> = {
      from: formatAddress(message.from),
      to: message.to.map((t) => t.email),
      subject: message.subject,
      html: message.html,
    };
    if (message.text) body.text = message.text;
    if (message.replyTo) body.reply_to = message.replyTo.email;
    if (message.headers) body.headers = message.headers;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
    };
    if (message.idempotencyKey) headers["Idempotency-Key"] = message.idempotencyKey;

    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        name?: string;
      };
      if (!res.ok) {
        const reason = data.message ?? data.name ?? `Resend HTTP ${res.status}`;
        return {
          providerMessageId: null,
          accepted: [],
          rejected: message.to.map((t) => ({ to: t.email, reason })),
        };
      }
      return {
        providerMessageId: data.id ?? null,
        accepted: message.to.map((t) => t.email),
        rejected: [],
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return {
        providerMessageId: null,
        accepted: [],
        rejected: message.to.map((t) => ({ to: t.email, reason })),
      };
    }
  }

  /**
   * Resend has no dedicated ping endpoint. We check the api_key shape
   * (`re_...` prefix, length) and call GET /domains as a cheap auth-only
   * probe. Domains endpoint returns 200 for any valid key even if no
   * domains are configured.
   */
  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!/^re_[A-Za-z0-9_]{10,}/.test(this.config.apiKey)) {
      return { ok: false, error: "Resend API key has invalid format (should start with re_)" };
    }
    try {
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(8_000),
      });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "Resend rejected the API key (401/403)" };
      }
      if (!res.ok) {
        return { ok: false, error: `Resend HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

function formatAddress(a: { email: string; name?: string }): string {
  if (a.name) {
    // Resend accepts "Name <email@host>" format.
    return `${a.name.replace(/[<>"]/g, "")} <${a.email}>`;
  }
  return a.email;
}
