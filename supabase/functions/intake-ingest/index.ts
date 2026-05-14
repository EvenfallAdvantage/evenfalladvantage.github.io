/**
 * Intake Ingest (Edge Function)
 *
 * Receives client intake submissions from external sources (a company's own
 * marketing site, a third-party form builder, Zapier, etc.) and lands them
 * in `client_intake_tokens` with `source = 'api'`.
 *
 * Auth:  Bearer <api_key>  in the Authorization header.
 *        Key is hashed (SHA-256) and matched against api_keys.key_hash.
 *
 * Body:  Any JSON object. Fields are remapped via the company's
 *        intake_field_mappings rows to canonical fields.
 *        Unmapped keys are preserved in raw_payload.
 *
 * Rate limit: 100 requests / 60 seconds per API key. 429 on excess.
 *
 * Returns: 201 { id, submission_id } on success.
 *
 * No JWT — external systems can't carry one. Authentication is the API key.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

/* ── Constants ──────────────────────────────────────────────────────── */

const RATE_LIMIT_WINDOW_MS = 60_000;          // 60s sliding window
const RATE_LIMIT_MAX = 100;                    // max requests per window per key
const MAX_BODY_BYTES = 64 * 1024;              // 64 KiB cap on payload
const CANONICAL_FIELDS = new Set([
  "client_name", "client_email", "client_phone",
  "service", "location", "message",
  "start_date", "end_date",
  "subject", "notes",
]);
const RESERVED_PREFIX = "ova_live_";

/* ── Helpers ────────────────────────────────────────────────────────── */

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function extractBearer(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match ? match[1].trim() : null;
}

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(origin),
      "Content-Type": "application/json",
      // Open CORS for this endpoint — external company sites need to call it.
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function pickString(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

/**
 * Apply field mappings: walk the incoming object, for each top-level key
 * find the canonical_field (if any), and produce a structured intake row.
 * Unmapped values are preserved in `extra`.
 */
function applyMappings(
  payload: Record<string, unknown>,
  mappings: { source_field: string; canonical_field: string }[],
): { canonical: Record<string, string>; extra: Record<string, unknown> } {
  const lookup = new Map<string, string>();
  for (const m of mappings) {
    // Lookup is case-insensitive on the source side
    lookup.set(m.source_field.toLowerCase().trim(), m.canonical_field);
  }

  const canonical: Record<string, string> = {};
  const extra: Record<string, unknown> = {};

  for (const [rawKey, rawValue] of Object.entries(payload)) {
    const key = rawKey.toLowerCase().trim();
    const canonicalField = lookup.get(key);
    if (canonicalField && CANONICAL_FIELDS.has(canonicalField)) {
      const str = pickString(rawValue);
      if (str !== null) {
        canonical[canonicalField] = str;
        continue;
      }
    }
    // Unmapped or non-string → keep in extra
    extra[rawKey] = rawValue;
  }

  return { canonical, extra };
}

/* ── Server ─────────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...getCorsHeaders(origin),
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, origin);
  }

  /* 1. Read body (with size cap) */
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return jsonResponse({ error: "invalid_body" }, 400, origin);
  }
  if (rawBody.length > MAX_BODY_BYTES) {
    return jsonResponse({ error: "payload_too_large", limit_bytes: MAX_BODY_BYTES }, 413, origin);
  }
  if (!rawBody.trim()) {
    return jsonResponse({ error: "empty_body" }, 400, origin);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, origin);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return jsonResponse({ error: "body_must_be_object" }, 400, origin);
  }
  const payload = parsed as Record<string, unknown>;

  /* 2. Authenticate via API key */
  const token = extractBearer(req);
  if (!token) {
    return jsonResponse({ error: "missing_bearer_token" }, 401, origin);
  }
  if (!token.startsWith(RESERVED_PREFIX)) {
    // We don't leak details about why it failed — same response as a bad hash.
    return jsonResponse({ error: "invalid_api_key" }, 401, origin);
  }

  const keyHash = await sha256Hex(token);

  /* 3. Build service-role client */
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.39.0");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: keyRow, error: keyErr } = await supabase
    .from("api_keys")
    .select("id, company_id, scopes, revoked_at, expires_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (keyErr || !keyRow) {
    return jsonResponse({ error: "invalid_api_key" }, 401, origin);
  }
  if (keyRow.revoked_at) {
    return jsonResponse({ error: "api_key_revoked" }, 401, origin);
  }
  if (keyRow.expires_at && new Date(keyRow.expires_at as string) < new Date()) {
    return jsonResponse({ error: "api_key_expired" }, 401, origin);
  }
  const scopes: string[] = Array.isArray(keyRow.scopes) ? (keyRow.scopes as string[]) : [];
  if (!scopes.includes("intake:write")) {
    return jsonResponse({ error: "insufficient_scope", required: "intake:write" }, 403, origin);
  }

  /* 4. Rate limit (sliding window) */
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count: recentCount } = await supabase
    .from("api_request_log")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", keyRow.id)
    .gte("created_at", windowStart);

  if ((recentCount ?? 0) >= RATE_LIMIT_MAX) {
    // Log the 429 so it appears in usage stats
    await supabase.from("api_request_log").insert({
      api_key_id: keyRow.id,
      endpoint: "intake-ingest",
      status_code: 429,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    return jsonResponse(
      { error: "rate_limited", limit: RATE_LIMIT_MAX, window_seconds: RATE_LIMIT_WINDOW_MS / 1000 },
      429,
      origin,
    );
  }

  /* 5. Load mappings for company */
  const { data: mappings } = await supabase
    .from("intake_field_mappings")
    .select("source_field, canonical_field")
    .eq("company_id", keyRow.company_id);

  const { canonical, extra } = applyMappings(payload, mappings ?? []);

  /* 6. Generate a token (so the submission is uniquely addressable + re-editable later) */
  const token16 = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const nowIso = new Date().toISOString();

  // Stash canonical fields (name/email/data) on the submission row.
  // The full canonical map AND unmapped fields live in raw_payload + data.
  const dataPayload = {
    ...canonical,
    extra,
    received_at: nowIso,
  };

  const { data: insertedRows, error: insErr } = await supabase
    .from("client_intake_tokens")
    .insert({
      id: crypto.randomUUID(),
      company_id: keyRow.company_id,
      token: token16,
      status: "submitted",
      source: "api",
      api_key_id: keyRow.id,
      client_name: canonical.client_name ?? null,
      client_email: canonical.client_email ?? null,
      data: dataPayload,
      raw_payload: payload,
      submitted_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id, token")
    .single();

  if (insErr || !insertedRows) {
    console.error("[intake-ingest] insert failed:", insErr?.message);
    await supabase.from("api_request_log").insert({
      api_key_id: keyRow.id,
      endpoint: "intake-ingest",
      status_code: 500,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    return jsonResponse({ error: "ingest_failed" }, 500, origin);
  }

  /* 7. Update last_used_at + log success */
  await Promise.all([
    supabase
      .from("api_keys")
      .update({ last_used_at: nowIso })
      .eq("id", keyRow.id),
    supabase.from("api_request_log").insert({
      api_key_id: keyRow.id,
      endpoint: "intake-ingest",
      status_code: 201,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    }),
  ]);

  return jsonResponse(
    {
      ok: true,
      submission_id: insertedRows.id,
      token: insertedRows.token,
      canonical_fields_captured: Object.keys(canonical),
      unmapped_field_count: Object.keys(extra).length,
    },
    201,
    origin,
  );
});
