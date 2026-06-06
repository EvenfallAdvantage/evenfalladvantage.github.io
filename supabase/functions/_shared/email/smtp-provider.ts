/**
 * SMTP provider via denomailer.
 *
 * denomailer is a pure-Deno SMTP client (no Node bindings) that works on
 * Supabase Edge Functions. Pinned to v1.6.0 — see deno.land/x/denomailer.
 *
 * Usage:
 *   const provider = new SmtpProvider({
 *     host: "smtp.example.com", port: 587, username, password, secure: false,
 *   });
 *   await provider.send({ to: [...], from: {...}, subject, html });
 */

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import type { EmailMessage, EmailProvider, SendResult, SmtpConfig } from "./types.ts";

export class SmtpProvider implements EmailProvider {
  readonly kind = "smtp" as const;
  constructor(private readonly config: SmtpConfig) {}

  private buildClient(): SMTPClient {
    return new SMTPClient({
      connection: {
        hostname: this.config.host,
        port: this.config.port,
        tls: this.config.secure,
        auth: {
          username: this.config.username,
          password: this.config.password,
        },
      },
    });
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const client = this.buildClient();
    try {
      await client.send({
        from: formatAddress(message.from),
        to: message.to.map(formatAddress),
        replyTo: message.replyTo ? formatAddress(message.replyTo) : undefined,
        subject: message.subject,
        content: message.text ?? stripHtml(message.html),
        html: message.html,
        headers: message.headers,
      });
      return {
        providerMessageId: null,
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
    } finally {
      try { await client.close(); } catch { /* ignore */ }
    }
  }

  /**
   * Open the socket and do AUTH but do NOT send a message. denomailer doesn't
   * expose a no-op AUTH-only path, so we use a low-cost workaround:
   * instantiate the client (which connects + authenticates on first use)
   * by calling .send() with a NOOP-style payload and catching specifically
   * the recipient-side errors. If we get past AUTH, the creds are good.
   *
   * Update: simpler — just try to open + close the connection. denomailer's
   * SMTPClient lazily connects on first send; we trigger it by sending to a
   * known-bad address and check whether the error is a 5xx recipient error
   * (good — creds worked) or a connection/auth error (bad).
   */
  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    const client = this.buildClient();
    try {
      // Try a tiny no-content send to a deliberately-invalid local address.
      // If AUTH succeeds, denomailer will hand off and the SMTP server will
      // reject the recipient (5xx), which we treat as success. If AUTH
      // fails, denomailer will throw before reaching the RCPT phase.
      await client.send({
        from: { mail: this.config.username, name: "Overwatch SMTP Test" },
        to: { mail: "noop@invalid.invalid", name: "Test" },
        subject: "SMTP connection test",
        content: "test",
      });
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // denomailer error patterns: "Auth failure", "BadResponse: 5xx ...",
      // or socket errors. If the failure mentions the recipient (550, 553,
      // "Recipient", "RCPT"), AUTH actually worked.
      const looksLikeRecipientRejection =
        /5\d\d/.test(msg) &&
        /(recipient|rcpt|address|mailbox|invalid)/i.test(msg);
      if (looksLikeRecipientRejection) return { ok: true };
      return { ok: false, error: msg };
    } finally {
      try { await client.close(); } catch { /* ignore */ }
    }
  }
}

function formatAddress(a: { email: string; name?: string }): { mail: string; name?: string } {
  return { mail: a.email, name: a.name };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
