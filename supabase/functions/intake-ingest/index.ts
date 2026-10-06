/**
 * Intake Ingest (Edge Function)
 *
 * Receives client intake / lead submissions from external sources (the
 * Evenfall Advantage estimate forms, a company's own site, Zapier, ...) and
 * lands them in `client_intake_tokens` with `source = 'api'`.
 *
 * Auth:  `Authorization: Bearer ova_live_...` (required). The key is hashed
 *        (SHA-256) and matched against api_keys.key_hash. It must carry the
 *        `intake:write` scope. Keys used from a browser (Origin header
 *        present) must carry ONLY `intake:write`: such a key is public in page
 *        source, and all it can do is create one lead row per request for its
 *        own company through this function. It is not a Supabase JWT and
 *        grants nothing in PostgREST, Storage or any other function.
 *
 * CORS:  Browser requests are accepted only from allowed origins
 *        (evenfalladvantage.com by default; add more with the
 *        INTAKE_ALLOWED_ORIGINS secret, comma-separated). Requests with no
 *        Origin (server-to-server) are allowed.
 *
 * Input: JSON object, <= 32 KiB, <= 60 top-level keys, scalars or arrays of
 *        scalars (nested objects are dropped), strings capped at 5000 chars,
 *        control characters stripped, client_email validated, at least one
 *        contact field (client_email / client_phone / email / phone).
 *        Canonical keys (client_name, client_email, ...) map to themselves;
 *        the company's intake_field_mappings can map any other key.
 *
 * Spam:  Honeypot field `company_website` (or `_hp`): when filled, respond
 *        201 as if accepted but store nothing.
 *
 * Rate limits: 100 requests/min per key; for browser requests also 5 per
 *        10 minutes and 20 per day per visitor IP per key. 429 on excess.
 *
 * Notify: when companies.settings.intakeNotifyEmails lists addresses
 *        (Settings -> API Sources -> "Email new leads to"), an email goes to
 *        them through the company's configured email provider (same factory
 *        as email-send; platform Resend fallback). Off when the list is empty.
 *
 * Returns: 201 { ok: true } on success. The row id / token are NOT returned.
 *
 * Deployed with verify_jwt = false (supabase/config.toml): external systems
 * can't carry a Supabase JWT; the API key is the authentication.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { resolveProviderForCompany } from "../_shared/email/factory.ts";
import {
  MAX_BODY_BYTES, RATE_LIMITS, applyMappings, buildLeadEmail, checkOrigin,
  checkScopes, clientIp, corsHeaders, notifyRecipients, parseAllowedOrigins,
  validatePayload, type CleanPayload,
} from "./lib.ts";

const RESERVED_PREFIX = "ova_live_";
const ENDPOINT = "intake-ingest";

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function extractBearer(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(auth.trim());
  return match ? match[1] : null;
}

// deno-lint-ignore no-explicit-any
type Db = any;

function runInBackground(p: Promise<unknown>) {
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p);
  else p.catch(() => {});
}

async function notifyCompany(supabase: Db, params: {
  companyId: string;
  canonical: Record<string, string>;
  extra: CleanPayload;
  submissionId: string;
}): Promise<void> {
  try {
    const { data: company } = await supabase
      .from("companies").select("name, settings").eq("id", params.companyId).single();
    const recipients = notifyRecipients(company?.settings);
    if (recipients.length === 0) return;

    const companyName = company?.name ?? "Overwatch";
    const factory = await resolveProviderForCompany(supabase, params.companyId, companyName);
    const email = buildLeadEmail({
      companyName,
      canonical: params.canonical,
      extra: params.extra,
      submissionId: params.submissionId,
      appUrl: Deno.env.get("OVERWATCH_APP_URL") ?? "https://www.evenfalladvantage.com/overwatch",
    });
    const replyTo = params.canonical.client_email ? { email: params.canonical.client_email } : factory.defaultReplyTo;
    const result = await factory.provider.send({
      to: recipients.map((e) => ({ email: e })),
      from: factory.defaultFrom,
      replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: `intake-${params.submissionId}`,
    });
    const rows = [
      ...result.accepted.map((to: string) => ({ to_email: to, status: "sent" })),
      ...result.rejected.map((r: { to: string; reason: string }) => ({ to_email: r.to, status: "rejected", error_message: r.reason })),
    ].map((r) => ({
      ...r,
      company_id: params.companyId,
      delivery_method: factory.provider.kind,
      from_email: factory.defaultFrom.email,
      subject: email.subject,
      purpose: "other",
      provider_id: result.providerMessageId,
      metadata: { kind: "intake_lead", submission_id: params.submissionId, used_fallback: factory.usedFallback },
    }));
    if (rows.length) await supabase.from("email_send_log").insert(rows);
  } catch (err) {
    console.error("[intake-ingest] notification failed:", err instanceof Error ? err.message : String(err));
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const allowed = parseAllowedOrigins(Deno.env.get("INTAKE_ALLOWED_ORIGINS"));
  const cors = corsHeaders(origin, allowed);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const originCheck = checkOrigin(origin, allowed);

  if (req.method === "OPTIONS") {
    return new Response(originCheck.ok ? "ok" : "origin_not_allowed", { status: originCheck.ok ? 200 : 403, headers: cors });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!originCheck.ok) return json({ error: "origin_not_allowed" }, 403);
  const browser = originCheck.browser;

  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return json({ error: "content_type_must_be_json" }, 415);
  }
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return json({ error: "payload_too_large", limit_bytes: MAX_BODY_BYTES }, 413);

  /* 1. Authenticate (before reading/validating the body) */
  const token = extractBearer(req);
  if (!token) return json({ error: "missing_bearer_token" }, 401);
  if (!token.startsWith(RESERVED_PREFIX) || token.length > 128) return json({ error: "invalid_api_key" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: keyRow, error: keyErr } = await supabase
    .from("api_keys")
    .select("id, company_id, scopes, revoked_at, expires_at")
    .eq("key_hash", await sha256Hex(token))
    .maybeSingle();
  if (keyErr || !keyRow) return json({ error: "invalid_api_key" }, 401);
  if (keyRow.revoked_at) return json({ error: "api_key_revoked" }, 401);
  if (keyRow.expires_at && new Date(keyRow.expires_at as string) < new Date()) {
    return json({ error: "api_key_expired" }, 401);
  }
  const scope = checkScopes(keyRow.scopes, browser);
  if (!scope.ok) return json({ error: scope.error }, scope.status);

  const ip = clientIp(req.headers);
  const log = (status_code: number) =>
    supabase.from("api_request_log").insert({ api_key_id: keyRow.id, endpoint: ENDPOINT, status_code, ip });

  /* 2. Rate limits */
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const { count: perKey } = await supabase
    .from("api_request_log").select("id", { count: "exact", head: true })
    .eq("api_key_id", keyRow.id).gte("created_at", since(60_000));
  let limited = (perKey ?? 0) >= RATE_LIMITS.perKeyPerMinute;

  if (!limited && browser && ip) {
    const [{ count: ip10 }, { count: ipDay }] = await Promise.all([
      supabase.from("api_request_log").select("id", { count: "exact", head: true })
        .eq("api_key_id", keyRow.id).eq("ip", ip).gte("created_at", since(10 * 60_000)),
      supabase.from("api_request_log").select("id", { count: "exact", head: true })
        .eq("api_key_id", keyRow.id).eq("ip", ip).gte("created_at", since(24 * 3600_000)),
    ]);
    limited = (ip10 ?? 0) >= RATE_LIMITS.perIpPer10Min || (ipDay ?? 0) >= RATE_LIMITS.perIpPerDay;
  }
  if (limited) {
    await log(429);
    return json({ error: "rate_limited" }, 429);
  }

  /* 3. Validate body */
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  const v = validatePayload(rawBody);
  if (!v.ok) {
    await log(v.status);
    return json({ error: v.error }, v.status);
  }

  /* 4. Honeypot: pretend success, store nothing */
  if (v.honeypot) {
    await log(202);
    return json({ ok: true }, 201);
  }

  /* 5. Map + insert */
  const { data: mappings } = await supabase
    .from("intake_field_mappings").select("source_field, canonical_field").eq("company_id", keyRow.company_id);
  const { canonical, extra } = applyMappings(v.payload, mappings ?? []);

  const nowIso = new Date().toISOString();
  const { data: inserted, error: insErr } = await supabase
    .from("client_intake_tokens")
    .insert({
      id: crypto.randomUUID(),
      company_id: keyRow.company_id,
      token: crypto.randomUUID().replace(/-/g, ""),
      status: "submitted",
      source: "api",
      api_key_id: keyRow.id,
      client_name: canonical.client_name ?? null,
      client_email: canonical.client_email ?? null,
      data: { ...canonical, extra, received_at: nowIso },
      raw_payload: v.payload,
      submitted_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    console.error("[intake-ingest] insert failed:", insErr?.message);
    await log(500);
    return json({ error: "ingest_failed" }, 500);
  }

  await Promise.all([
    supabase.from("api_keys").update({ last_used_at: nowIso }).eq("id", keyRow.id),
    log(201),
  ]);

  /* 6. Notify the company (best effort, after responding) */
  runInBackground(notifyCompany(supabase, { companyId: keyRow.company_id, canonical, extra, submissionId: inserted.id }));

  return json({ ok: true }, 201);
});
