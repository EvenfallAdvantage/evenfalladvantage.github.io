/**
 * Minimal Stripe helpers for Edge Functions (no SDK: the Node SDK's
 * synchronous webhook verification throws in Deno, which is what broke the
 * old EADB process-course-payment function).
 *
 *  - formEncode():            nested objects/arrays -> Stripe's form encoding
 *  - verifyStripeSignature(): Stripe-Signature header check (HMAC-SHA256 over
 *                             "<t>.<raw body>", constant-time compare,
 *                             5-minute replay tolerance, any v1 may match)
 *  - stripeFetch():           authenticated call to api.stripe.com
 */

export const STRIPE_API = "https://api.stripe.com/v1";
export const STRIPE_SIGNATURE_TOLERANCE_S = 300;

type FormValue = string | number | boolean | null | undefined | FormValue[] | { [k: string]: FormValue };

/** Encode `{ a: { b: 1 }, c: [{ d: "x" }] }` as `a[b]=1&c[0][d]=x`. Null/undefined are skipped. */
export function formEncode(obj: Record<string, FormValue>): string {
  const out: string[] = [];
  const walk = (prefix: string, v: FormValue) => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(`${prefix}[${i}]`, item));
    } else if (typeof v === "object") {
      for (const [k, val] of Object.entries(v)) walk(`${prefix}[${k}]`, val);
    } else {
      out.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(v))}`);
    }
  };
  for (const [k, v] of Object.entries(obj)) walk(k, v);
  return out.join("&");
}

export interface ParsedSignature { timestamp: number; signatures: string[] }

export function parseSignatureHeader(header: string | null | undefined): ParsedSignature | null {
  if (!header) return null;
  let timestamp = NaN;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t") timestamp = Number(v);
    else if (k === "v1" && /^[0-9a-f]{64}$/i.test(v)) signatures.push(v.toLowerCase());
  }
  if (!Number.isFinite(timestamp) || timestamp <= 0 || signatures.length === 0) return null;
  return { timestamp, signatures };
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two equal-length hex strings. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

export type SignatureResult =
  | { ok: true; timestamp: number }
  | { ok: false; reason: "missing_secret" | "bad_header" | "timestamp_out_of_tolerance" | "no_matching_signature" };

/**
 * Verify a Stripe webhook. `payload` must be the exact raw request body.
 * `nowS` is injectable for tests.
 */
export async function verifyStripeSignature(
  payload: string,
  header: string | null | undefined,
  secret: string | null | undefined,
  nowS: number = Math.floor(Date.now() / 1000),
  toleranceS: number = STRIPE_SIGNATURE_TOLERANCE_S,
): Promise<SignatureResult> {
  if (!secret) return { ok: false, reason: "missing_secret" };
  const parsed = parseSignatureHeader(header);
  if (!parsed) return { ok: false, reason: "bad_header" };
  if (Math.abs(nowS - parsed.timestamp) > toleranceS) return { ok: false, reason: "timestamp_out_of_tolerance" };
  const expected = await hmacSha256Hex(secret, `${parsed.timestamp}.${payload}`);
  const match = parsed.signatures.some((s) => timingSafeEqualHex(s, expected));
  return match ? { ok: true, timestamp: parsed.timestamp } : { ok: false, reason: "no_matching_signature" };
}

export interface StripeResponse<T> { ok: boolean; status: number; body: T }

/** POST/GET to the Stripe API with the secret key. Never logs the key. */
export async function stripeFetch<T = Record<string, unknown>>(
  secretKey: string,
  path: string,
  init: { method?: "GET" | "POST"; form?: Record<string, FormValue>; idempotencyKey?: string; timeoutMs?: number } = {},
): Promise<StripeResponse<T>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    "Stripe-Version": "2024-06-20",
  };
  if (init.form) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: init.method ?? (init.form ? "POST" : "GET"),
    headers,
    body: init.form ? formEncode(init.form) : undefined,
    signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
  });
  let body: unknown = null;
  try { body = await res.json(); } catch { body = null; }
  return { ok: res.ok, status: res.status, body: body as T };
}
