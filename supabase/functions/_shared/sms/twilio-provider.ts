/**
 * Twilio SMS provider — REST API via HTTPS fetch (no SDK).
 *
 * Endpoint: POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
 * Auth:     HTTP Basic (AccountSid:AuthToken)
 * Body:     application/x-www-form-urlencoded (To, From, Body)
 */

import type { SendResult, SmsMessage, SmsProvider, TwilioConfig } from "./types.ts";

function basicAuth(sid: string, token: string): string {
  // Edge Functions run in Deno; btoa is global.
  return "Basic " + btoa(`${sid}:${token}`);
}

export class TwilioProvider implements SmsProvider {
  readonly kind = "twilio" as const;
  constructor(private cfg: TwilioConfig) {}

  async send(message: SmsMessage): Promise<SendResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.cfg.accountSid)}/Messages.json`;

    // From may be a phone number OR a messaging-service SID. Messaging-service
    // SIDs start with 'MG'; numbers start with '+'. Twilio accepts either as
    // 'From' OR a separate 'MessagingServiceSid' field. We pick the right param.
    const form = new URLSearchParams();
    form.set("To", message.to);
    if (message.from.startsWith("MG")) {
      form.set("MessagingServiceSid", message.from);
    } else {
      form.set("From", message.from);
    }
    form.set("Body", message.body);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: basicAuth(this.cfg.accountSid, this.cfg.authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    let payload: Record<string, unknown> = {};
    try {
      payload = (await res.json()) as Record<string, unknown>;
    } catch {
      // Twilio always returns JSON; treat parse failure as a transport error.
    }

    if (!res.ok) {
      const reason =
        (payload.message as string) ||
        (payload.code != null ? `Twilio error ${payload.code}` : `HTTP ${res.status}`);
      return {
        providerMessageId: null,
        accepted: [],
        rejected: [{ to: message.to, reason }],
      };
    }

    const sid = (payload.sid as string) ?? null;
    return {
      providerMessageId: sid,
      accepted: [message.to],
      rejected: [],
    };
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.cfg.accountSid)}.json`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: basicAuth(this.cfg.accountSid, this.cfg.authToken),
        },
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as Record<string, unknown>;
          if (body.message) msg = String(body.message);
        } catch {
          /* ignore */
        }
        return { ok: false, error: msg };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
