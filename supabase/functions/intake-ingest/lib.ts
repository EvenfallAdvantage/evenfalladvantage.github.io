/**
 * Pure helpers for intake-ingest (no network, no Deno APIs) so they can be
 * unit-tested with `deno test`.
 */

import { escapeHtml } from "../_shared/html.ts";

/* ── Limits ─────────────────────────────────────────────────────────── */

export const MAX_BODY_BYTES = 32 * 1024;   // whole JSON body
export const MAX_FIELDS = 60;              // top-level keys
export const MAX_KEY_LENGTH = 64;
export const MAX_VALUE_LENGTH = 5000;      // per string value
export const MAX_ARRAY_ITEMS = 25;         // arrays of scalars only
export const MAX_NOTIFY_RECIPIENTS = 5;

/** Hidden form field real visitors never fill in (js/form-validation.js). */
export const HONEYPOT_FIELDS = ["company_website", "_hp"] as const;

export const CANONICAL_FIELDS = new Set([
  "client_name", "client_email", "client_phone",
  "service", "location", "message",
  "start_date", "end_date",
  "subject", "notes",
]);

/** Browser origins allowed by default. More can be added per deployment via
 *  the INTAKE_ALLOWED_ORIGINS secret (comma-separated). */
export const DEFAULT_ALLOWED_ORIGINS = [
  "https://www.evenfalladvantage.com",
  "https://evenfalladvantage.com",
];

export const INTAKE_ONLY_SCOPE = "intake:write";

const EMAIL_RE = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[A-Za-z]{2,24}$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value);
}

/* ── Origin / CORS ──────────────────────────────────────────────────── */

export function parseAllowedOrigins(extra: string | undefined | null): string[] {
  const list = new Set(DEFAULT_ALLOWED_ORIGINS);
  for (const raw of (extra ?? "").split(",")) {
    const o = raw.trim().replace(/\/$/, "");
    if (/^https?:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(o)) list.add(o);
  }
  return [...list];
}

/**
 * Browser requests carry an Origin header and must come from an allowed site.
 * Server-to-server callers (Zapier, a company's backend) send no Origin and
 * are allowed; CORS doesn't apply to them and the API key still gates them.
 */
export function checkOrigin(origin: string | null, allowed: string[]):
  { ok: true; browser: boolean } | { ok: false } {
  if (!origin) return { ok: true, browser: false };
  return allowed.includes(origin) ? { ok: true, browser: true } : { ok: false };
}

export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

/* ── API key scope ──────────────────────────────────────────────────── */

/**
 * The key must carry intake:write. A key used from a browser (and therefore
 * visible in page source) must carry ONLY intake:write, so a more powerful
 * key can never be published by mistake.
 */
export function checkScopes(scopes: unknown, browser: boolean):
  { ok: true } | { ok: false; status: 403; error: string } {
  const list = Array.isArray(scopes) ? scopes.filter((s) => typeof s === "string") as string[] : [];
  if (!list.includes(INTAKE_ONLY_SCOPE)) {
    return { ok: false, status: 403, error: "insufficient_scope" };
  }
  if (browser && list.some((s) => s !== INTAKE_ONLY_SCOPE)) {
    return { ok: false, status: 403, error: "browser_key_must_be_intake_only" };
  }
  return { ok: true };
}

/* ── Payload validation ─────────────────────────────────────────────── */

export type Scalar = string | number | boolean | null;
export type CleanPayload = Record<string, Scalar | Scalar[]>;

export type ValidationResult =
  | { ok: true; payload: CleanPayload; honeypot: boolean }
  | { ok: false; status: 400 | 413; error: string };

function cleanString(s: string): string {
  // Drop control characters except tab/newline/carriage return.
  // deno-lint-ignore no-control-regex
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

function cleanScalar(v: unknown): Scalar | undefined {
  if (v === null) return null;
  if (typeof v === "string") return cleanString(v).slice(0, MAX_VALUE_LENGTH);
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "boolean") return v;
  return undefined; // objects / functions are dropped
}

/** Validate size + shape, drop nested objects, cap lengths, detect honeypot. */
export function validatePayload(rawBody: string): ValidationResult {
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }
  if (!rawBody.trim()) return { ok: false, status: 400, error: "empty_body" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, status: 400, error: "body_must_be_object" };
  }

  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length > MAX_FIELDS) return { ok: false, status: 400, error: "too_many_fields" };

  let honeypot = false;
  const payload: CleanPayload = {};
  for (const [rawKey, rawValue] of entries) {
    const key = cleanString(rawKey);
    if (!key || key.length > MAX_KEY_LENGTH || key === "__proto__" || key === "constructor" || key === "prototype") continue;

    if ((HONEYPOT_FIELDS as readonly string[]).includes(key)) {
      if (rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== "") honeypot = true;
      continue; // never stored
    }

    if (Array.isArray(rawValue)) {
      const items = rawValue.slice(0, MAX_ARRAY_ITEMS).map(cleanScalar).filter((x): x is Scalar => x !== undefined);
      payload[key] = items;
      continue;
    }
    const v = cleanScalar(rawValue);
    if (v !== undefined) payload[key] = v;
  }

  if (payload.client_email !== undefined && payload.client_email !== null && payload.client_email !== "") {
    if (!isValidEmail(payload.client_email)) return { ok: false, status: 400, error: "invalid_client_email" };
  }
  if (typeof payload.client_phone === "string" && payload.client_phone.length > 40) {
    return { ok: false, status: 400, error: "invalid_client_phone" };
  }
  if (!honeypot && !hasContact(payload)) {
    return { ok: false, status: 400, error: "missing_contact" };
  }
  return { ok: true, payload, honeypot };
}

function hasContact(p: CleanPayload): boolean {
  const s = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  return s(p.client_email) || s(p.client_phone) || s(p.email) || s(p.phone);
}

/* ── Field mapping ──────────────────────────────────────────────────── */

function pickString(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const joined = value.filter((v) => v !== null && v !== "").join(", ");
    return joined.length > 0 ? joined : null;
  }
  return null;
}

/**
 * Explicit mappings (company's intake_field_mappings) win. A key that already
 * is a canonical field name (client_name, client_email, ...) maps to itself
 * when there is no explicit mapping for it, so a form that posts canonical
 * keys works without any mapping setup.
 */
export function applyMappings(
  payload: CleanPayload,
  mappings: { source_field: string; canonical_field: string }[],
): { canonical: Record<string, string>; extra: CleanPayload } {
  const lookup = new Map<string, string>();
  for (const m of mappings) lookup.set(m.source_field.toLowerCase().trim(), m.canonical_field);

  const canonical: Record<string, string> = {};
  const extra: CleanPayload = {};
  for (const [rawKey, rawValue] of Object.entries(payload)) {
    const key = rawKey.toLowerCase().trim();
    const target = lookup.get(key) ?? (CANONICAL_FIELDS.has(key) ? key : undefined);
    if (target && CANONICAL_FIELDS.has(target) && canonical[target] === undefined) {
      const str = pickString(rawValue);
      if (str !== null) {
        canonical[target] = str.slice(0, MAX_VALUE_LENGTH);
        continue;
      }
    }
    extra[rawKey] = rawValue;
  }
  return { canonical, extra };
}

/* ── Notification ───────────────────────────────────────────────────── */

/** Company setting companies.settings.intakeNotifyEmails -> valid, deduped list. */
export function notifyRecipients(settings: unknown): string[] {
  const raw = (settings && typeof settings === "object")
    ? (settings as Record<string, unknown>).intakeNotifyEmails
    : undefined;
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,;\s]+/) : [];
  const out: string[] = [];
  for (const e of list) {
    const v = typeof e === "string" ? e.trim().toLowerCase() : "";
    if (isValidEmail(v) && !out.includes(v)) out.push(v);
    if (out.length >= MAX_NOTIFY_RECIPIENTS) break;
  }
  return out;
}

const LABELS: Record<string, string> = {
  client_name: "Name", client_email: "Email", client_phone: "Phone",
  service: "Service", location: "Location", start_date: "Start date",
  end_date: "End date", subject: "Subject", message: "Message", notes: "Notes",
};

export function buildLeadEmail(params: {
  companyName: string;
  canonical: Record<string, string>;
  extra: CleanPayload;
  submissionId: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const c = params.canonical;
  const who = c.client_name || c.client_email || c.client_phone || "New contact";
  const what = c.service || c.subject || "Website lead";
  // Header injection guard: no CR/LF in the subject.
  const subject = `New lead: ${what} - ${who}`.replace(/[\r\n]+/g, " ").slice(0, 200);

  const rows: [string, string][] = [];
  for (const key of Object.keys(LABELS)) if (c[key]) rows.push([LABELS[key], c[key]]);
  for (const [k, v] of Object.entries(params.extra).slice(0, 40)) {
    const s = Array.isArray(v) ? v.join(", ") : v === null ? "" : String(v);
    if (s) rows.push([k, s.slice(0, 1000)]);
  }

  const htmlRows = rows.map(([k, v]) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">${escapeHtml(k)}</td>` +
    `<td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`).join("");
  const link = `${params.appUrl.replace(/\/$/, "")}/admin/events/`;
  const html =
    `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px;color:#111">` +
    `<p>A new lead was submitted to <strong>${escapeHtml(params.companyName)}</strong>.</p>` +
    `<table style="border-collapse:collapse">${htmlRows}</table>` +
    `<p style="margin-top:16px">Open Overwatch to follow up: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>` +
    `<p style="color:#888;font-size:12px">Submission ${escapeHtml(params.submissionId)}. ` +
    `Replying to this email does not reach the visitor; use their contact details above.</p></div>`;
  const text = [
    `A new lead was submitted to ${params.companyName}.`, "",
    ...rows.map(([k, v]) => `${k}: ${v}`), "",
    `Open Overwatch: ${link}`, `Submission ${params.submissionId}`,
  ].join("\n");
  return { subject, html, text };
}

/* ── Rate limiting ──────────────────────────────────────────────────── */

export const RATE_LIMITS = {
  perKeyPerMinute: 100,     // existing behaviour
  perIpPer10Min: 5,         // browser submissions per visitor IP per key
  perIpPerDay: 20,
} as const;

export function clientIp(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim().slice(0, 64);
  const xff = headers.get("x-forwarded-for");
  return xff ? xff.split(",")[0].trim().slice(0, 64) : null;
}
