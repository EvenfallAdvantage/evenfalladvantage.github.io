/**
 * Webhook pipeline, independent of Supabase so it can be tested with fixtures:
 *   adapter lookup -> handshake -> (connection lookup) -> FAIL-CLOSED signature
 *   check -> identify -> dedupe/store -> 2xx fast -> async processing.
 */
import { redactPayload } from "./redact.ts";
import type { LiveConnection, VendorAdapter } from "./types.ts";

export const MAX_WEBHOOK_BYTES = 512 * 1024;

export interface WebhookStore {
  /** Find the connection for an external account id (or by company for per-company URLs). */
  findConnection(provider: string, externalAccountId: string | null): Promise<LiveConnection | null>;
  /** Insert the event; return false when (provider, eventId) already exists. */
  insertEvent(e: { provider: string; companyId: string | null; connectionId: string | null; eventId: string; type: string | null; payload: unknown }): Promise<{ inserted: boolean; id?: string }>;
  touchConnection(connectionId: string): Promise<void>;
  audit(e: { companyId: string | null; outcome: "success" | "failure" | "blocked"; metadata: Record<string, unknown> }): Promise<void>;
}

export interface WebhookResult {
  response: Response;
  process?: { eventId: string; type: string | null; payload: unknown; conn: LiveConnection | null };
}

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function handleWebhookRequest(
  req: Request,
  adapter: VendorAdapter | null,
  provider: string,
  store: WebhookStore,
  env: (n: string) => string | undefined,
): Promise<WebhookResult> {
  if (!adapter) return { response: reply(404, { error: "unknown provider" }) };

  if (req.method === "GET") {
    const hs = adapter.webhookHandshake?.(req, env);
    return { response: hs ?? reply(405, { error: "method not allowed" }) };
  }
  if (req.method !== "POST") return { response: reply(405, { error: "method not allowed" }) };
  if (!adapter.verifyWebhook || !adapter.identifyWebhook) return { response: reply(404, { error: "webhooks not supported" }) };

  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_WEBHOOK_BYTES) return { response: reply(413, { error: "too large" }) };
  const rawBody = await req.text();
  if (rawBody.length > MAX_WEBHOOK_BYTES) return { response: reply(413, { error: "too large" }) };

  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch { payload = null; }

  // Per-company HMAC keys (Checkr direct mode) need the connection BEFORE verifying.
  let identity: ReturnType<NonNullable<VendorAdapter["identifyWebhook"]>> | null = null;
  try { identity = payload !== null ? adapter.identifyWebhook(payload, req.headers) : null; } catch { identity = null; }
  const conn = identity ? await store.findConnection(provider, identity.externalAccountId ?? null) : null;
  if (adapter.webhookNeedsConnection && !conn) {
    await store.audit({ companyId: null, outcome: "blocked", metadata: { provider, reason: "unknown account" } });
    return { response: reply(401, { error: "unauthorized" }) };
  }

  let ok = false;
  try { ok = await adapter.verifyWebhook({ rawBody, headers: req.headers, conn, env }); } catch { ok = false; }
  if (!ok) {
    await store.audit({ companyId: conn?.company_id ?? null, outcome: "blocked", metadata: { provider, reason: "bad signature" } });
    return { response: reply(401, { error: "unauthorized" }) };
  }
  if (!identity) return { response: reply(400, { error: "unrecognised payload" }) };

  const ins = await store.insertEvent({
    provider, companyId: conn?.company_id ?? null, connectionId: conn?.id ?? null,
    eventId: identity.eventId, type: identity.type, payload: redactPayload(payload),
  });
  if (!ins.inserted) return { response: reply(200, { ok: true, duplicate: true }) };
  if (conn) await store.touchConnection(conn.id);
  await store.audit({ companyId: conn?.company_id ?? null, outcome: "success", metadata: { provider, type: identity.type, event_id: identity.eventId } });
  return { response: reply(200, { ok: true }), process: { eventId: identity.eventId, type: identity.type, payload, conn } };
}
