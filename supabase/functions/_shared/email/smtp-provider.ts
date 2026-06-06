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

/**
 * Supabase Edge Functions block outbound connections to ports 25 and 587.
 * SMTP-via-Edge therefore requires port 465 (TLS-on-connect) or one of the
 * provider-specific submission ports (e.g. SendGrid 2525, AWS SES 2587).
 * See: https://supabase.com/docs/guides/functions/limits
 */
const BLOCKED_SMTP_PORTS = new Set<number>([25, 587]);

/**
 * Hard deadline for any SMTP operation. denomailer's socket handshake will
 * happily wait forever against a black-holed port; without this cap, the
 * Edge Function gets terminated by the platform with no CORS-decorated
 * response, surfacing in the browser as "Failed to fetch" / "no ACAO".
 */
const SMTP_DEADLINE_MS = 15_000;

function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`SMTP operation timed out after ${ms}ms`)),
      ms,
    );
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

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

  /**
   * Pre-flight check that surfaces the Supabase port-block as a clear
   * error rather than letting the connection silently hang.
   */
  private checkPort(): { ok: boolean; error?: string } {
    if (BLOCKED_SMTP_PORTS.has(this.config.port)) {
      return {
        ok: false,
        error:
          `Supabase Edge Functions block outbound port ${this.config.port}. ` +
          `Switch to port 465 (TLS on connect) — most providers support both 465 and 587.`,
      };
    }
    return { ok: true };
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const portCheck = this.checkPort();
    if (!portCheck.ok) {
      return {
        providerMessageId: null,
        accepted: [],
        rejected: message.to.map((t) => ({
          to: t.email,
          reason: portCheck.error ?? "Port blocked",
        })),
      };
    }
    const client = this.buildClient();
    try {
      await withDeadline(
        client.send({
          from: formatAddress(message.from),
          to: message.to.map(formatAddress),
          replyTo: message.replyTo ? formatAddress(message.replyTo) : undefined,
          subject: message.subject,
          content: message.text ?? stripHtml(message.html),
          html: message.html,
          headers: message.headers,
        }),
        SMTP_DEADLINE_MS,
      );
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
      try { await withDeadline(client.close(), 2_000); } catch { /* ignore */ }
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
    const portCheck = this.checkPort();
    if (!portCheck.ok) return portCheck;
    const client = this.buildClient();
    try {
      // Try a tiny no-content send to a deliberately-invalid local address.
      // If AUTH succeeds, denomailer will hand off and the SMTP server will
      // reject the recipient (5xx), which we treat as success. If AUTH
      // fails, denomailer will throw before reaching the RCPT phase.
      await withDeadline(
        client.send({
          from: { mail: this.config.username, name: "Overwatch SMTP Test" },
          to: { mail: "noop@invalid.invalid", name: "Test" },
          subject: "SMTP connection test",
          content: "test",
        }),
        SMTP_DEADLINE_MS,
      );
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
      try { await withDeadline(client.close(), 2_000); } catch { /* ignore */ }
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
