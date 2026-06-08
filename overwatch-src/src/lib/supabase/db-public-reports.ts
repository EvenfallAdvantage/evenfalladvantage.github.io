/**
 * Public Incident Reports (Phase 4 / HaloEngage)
 *
 * - Anonymous users submit reports via a per-company "link" identified by a
 *   slug. The slug acts as the share-link security token (printable on a QR).
 * - Authenticated members triage submissions and can promote them into the
 *   regular incidents queue (with source='public' and a back-link).
 *
 * Tables (via SQL migration `add-public-incident-reports.sql`):
 *  - public_report_links
 *  - public_report_submissions
 *  - public_report_messages   (Phase 4.7 — reply thread)
 */

import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";
import { logDbReadError } from "./db-error";
import { createIncidentEnhanced } from "./db-incidents";

// ─── Types ─────────────────────────────────────────────────

export type SubmissionStatus = "new" | "triaging" | "promoted" | "dismissed";

export interface PublicReportLink {
  id: string;
  companyId: string;
  teamId: string | null;
  slug: string;
  label: string;
  defaultType: string | null;
  isActive: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicReportSubmission {
  id: string;
  linkId: string;
  companyId: string;
  reporterName: string | null;
  reporterPhone: string | null;
  reporterEmail: string | null;
  body: string;
  location: string | null;
  locationLat: number | null;
  locationLng: number | null;
  media: Array<{ path: string; mime?: string; size?: number }>;
  status: SubmissionStatus;
  incidentId: string | null;
  triagedById: string | null;
  triagedAt: string | null;
  createdAt: string;
}

export interface PublicReportMessage {
  id: string;
  submissionId: string;
  companyId: string;
  direction: "inbound" | "outbound";
  channel: "sms" | "email" | "note";
  body: string;
  sentById: string | null;
  externalId: string | null;
  createdAt: string;
}

// ─── Mapping helpers ───────────────────────────────────────

interface LinkRow {
  id: string;
  company_id: string;
  team_id: string | null;
  slug: string;
  label: string;
  default_type: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapLink(r: LinkRow): PublicReportLink {
  return {
    id: r.id,
    companyId: r.company_id,
    teamId: r.team_id,
    slug: r.slug,
    label: r.label,
    defaultType: r.default_type,
    isActive: r.is_active,
    createdById: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

interface SubmissionRow {
  id: string;
  link_id: string;
  company_id: string;
  reporter_name: string | null;
  reporter_phone: string | null;
  reporter_email: string | null;
  body: string;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
  media: Array<{ path: string; mime?: string; size?: number }> | null;
  status: SubmissionStatus;
  incident_id: string | null;
  triaged_by: string | null;
  triaged_at: string | null;
  created_at: string;
}

function mapSubmission(r: SubmissionRow): PublicReportSubmission {
  return {
    id: r.id,
    linkId: r.link_id,
    companyId: r.company_id,
    reporterName: r.reporter_name,
    reporterPhone: r.reporter_phone,
    reporterEmail: r.reporter_email,
    body: r.body,
    location: r.location,
    locationLat: r.location_lat,
    locationLng: r.location_lng,
    media: r.media ?? [],
    status: r.status,
    incidentId: r.incident_id,
    triagedById: r.triaged_by,
    triagedAt: r.triaged_at,
    createdAt: r.created_at,
  };
}

interface MessageRow {
  id: string;
  submission_id: string;
  company_id: string;
  direction: "inbound" | "outbound";
  channel: "sms" | "email" | "note";
  body: string;
  sent_by: string | null;
  external_id: string | null;
  created_at: string;
}

function mapMessage(r: MessageRow): PublicReportMessage {
  return {
    id: r.id,
    submissionId: r.submission_id,
    companyId: r.company_id,
    direction: r.direction,
    channel: r.channel,
    body: r.body,
    sentById: r.sent_by,
    externalId: r.external_id,
    createdAt: r.created_at,
  };
}

// ─── Slug generation ──────────────────────────────────────

/**
 * Generates a URL-safe 16-character slug from a crypto random source.
 * Avoids ambiguous characters (0/O, 1/l/I).
 */
export function generateReportSlug(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const len = 16;
  const out = new Array<string>(len);
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) {
    out[i] = alphabet[bytes[i] % alphabet.length];
  }
  return out.join("");
}

// ─── Links CRUD (authenticated) ───────────────────────────

export async function getPublicReportLinks(companyId: string): Promise<PublicReportLink[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("public_report_links")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) {
    logDbReadError("public report links", error);
    return [];
  }
  return (data ?? []).map((r: unknown) => mapLink(r as LinkRow));
}

export async function createPublicReportLink(
  companyId: string,
  params: { label: string; teamId?: string | null; defaultType?: string | null; isActive?: boolean }
): Promise<PublicReportLink | null> {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const slug = generateReportSlug();

  const { data, error } = await supabase
    .from("public_report_links")
    .insert({
      id: crypto.randomUUID(),
      company_id: companyId,
      team_id: params.teamId ?? null,
      slug,
      label: params.label,
      default_type: params.defaultType ?? null,
      is_active: params.isActive ?? true,
      created_by: userId,
      ...ts(),
    })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? mapLink(data as LinkRow) : null;
}

export async function updatePublicReportLink(
  linkId: string,
  updates: Partial<{
    label: string;
    teamId: string | null;
    defaultType: string | null;
    isActive: boolean;
  }>
): Promise<PublicReportLink | null> {
  const supabase = createClient();
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.label !== undefined) payload.label = updates.label;
  if (updates.teamId !== undefined) payload.team_id = updates.teamId;
  if (updates.defaultType !== undefined) payload.default_type = updates.defaultType;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;

  const { data, error } = await supabase
    .from("public_report_links")
    .update(payload)
    .eq("id", linkId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? mapLink(data as LinkRow) : null;
}

export async function deletePublicReportLink(linkId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("public_report_links").delete().eq("id", linkId);
  return !error;
}

// ─── Anonymous link lookup + submission ───────────────────

/**
 * Resolve a slug to a link (anon-callable read). Only returns active links.
 */
export async function getPublicReportLinkBySlug(slug: string): Promise<PublicReportLink | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("public_report_links")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    logDbReadError("public report link by slug", error);
    return null;
  }
  return data ? mapLink(data as LinkRow) : null;
}

/**
 * Submit a public incident report. Anon-callable (RLS enforces the link is
 * active and matches the supplied company_id).
 */
export async function submitPublicReport(
  linkId: string,
  companyId: string,
  payload: {
    body: string;
    reporterName?: string;
    reporterPhone?: string;
    reporterEmail?: string;
    location?: string;
    locationLat?: number;
    locationLng?: number;
    media?: Array<{ path: string; mime?: string; size?: number }>;
  }
): Promise<PublicReportSubmission | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("public_report_submissions")
    .insert({
      id: crypto.randomUUID(),
      link_id: linkId,
      company_id: companyId,
      reporter_name: payload.reporterName ?? null,
      reporter_phone: payload.reporterPhone ?? null,
      reporter_email: payload.reporterEmail ?? null,
      body: payload.body,
      location: payload.location ?? null,
      location_lat: payload.locationLat ?? null,
      location_lng: payload.locationLng ?? null,
      media: payload.media ?? [],
      status: "new",
      created_at: new Date().toISOString(),
    })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? mapSubmission(data as SubmissionRow) : null;
}

// ─── Submissions (authenticated triage queue) ─────────────

export async function getPublicReportSubmissions(
  companyId: string,
  filters?: { status?: SubmissionStatus; linkId?: string }
): Promise<PublicReportSubmission[]> {
  const supabase = createClient();
  let q = supabase
    .from("public_report_submissions")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.linkId) q = q.eq("link_id", filters.linkId);
  const { data, error } = await q;
  if (error) {
    logDbReadError("public report submissions", error);
    return [];
  }
  return (data ?? []).map((r: unknown) => mapSubmission(r as SubmissionRow));
}

export async function getPublicReportSubmission(
  submissionId: string
): Promise<PublicReportSubmission | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("public_report_submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle();
  if (error) {
    logDbReadError("public report submission", error);
    return null;
  }
  return data ? mapSubmission(data as SubmissionRow) : null;
}

export async function setPublicReportSubmissionStatus(
  submissionId: string,
  status: SubmissionStatus
): Promise<PublicReportSubmission | null> {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("public_report_submissions")
    .update({
      status,
      triaged_by: userId,
      triaged_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? mapSubmission(data as SubmissionRow) : null;
}

/**
 * Promote a public submission into the regular incidents queue. Creates an
 * incidents row with source='public', updates the submission to status=promoted
 * with incident_id back-link, and returns the new incident id.
 */
export async function promotePublicReportToIncident(
  submission: PublicReportSubmission,
  options?: {
    teamId?: string | null;
    type?: string;
    severity?: string;
    priority?: string;
    title?: string;
  }
): Promise<{ incidentId: string; submission: PublicReportSubmission } | null> {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();

  const title =
    options?.title ??
    (submission.body.length > 80 ? `${submission.body.slice(0, 77)}...` : submission.body) ??
    "Public report";

  const inc = await createIncidentEnhanced(submission.companyId, {
    title,
    description: submission.body,
    type: options?.type,
    severity: options?.severity,
    priority: options?.priority,
    location: submission.location ?? undefined,
    teamId: options?.teamId ?? undefined,
    source: "public",
  });

  if (!inc?.id) return null;

  const { data, error } = await supabase
    .from("public_report_submissions")
    .update({
      status: "promoted",
      incident_id: inc.id,
      triaged_by: userId,
      triaged_at: new Date().toISOString(),
    })
    .eq("id", submission.id)
    .select("*")
    .maybeSingle();
  if (error) throw error;

  return {
    incidentId: inc.id,
    submission: data ? mapSubmission(data as SubmissionRow) : submission,
  };
}

// ─── Messages thread (Phase 4.7) ───────────────────────────

export async function getPublicReportMessages(
  submissionId: string
): Promise<PublicReportMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("public_report_messages")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: true });
  if (error) {
    logDbReadError("public report messages", error);
    return [];
  }
  return (data ?? []).map((r: unknown) => mapMessage(r as MessageRow));
}

export async function addPublicReportNote(
  submissionId: string,
  companyId: string,
  body: string
): Promise<PublicReportMessage | null> {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("public_report_messages")
    .insert({
      id: crypto.randomUUID(),
      submission_id: submissionId,
      company_id: companyId,
      direction: "outbound",
      channel: "note",
      body,
      sent_by: userId,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? mapMessage(data as MessageRow) : null;
}

/**
 * Invoke the `sms-reply-to-reporter` Edge Function to send an SMS reply to
 * the reporter and append it to the message thread. The Edge Function handles
 * RBAC, rate limiting, audit logging, and the actual dispatch.
 */
export async function replyToReporterViaSms(
  submissionId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Not signed in" };
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return { ok: false, error: "Supabase URL missing" };
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/functions/v1/sms-reply-to-reporter`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ submission_id: submissionId, body }),
    });
    const result = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) return { ok: false, error: result.error ?? `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Append a message row to the thread. This is called from the SMS edge
 * function after a successful send to keep the audit trail intact. The edge
 * function passes its service-role client; the client-side helper is provided
 * for the optimistic "note" channel only.
 */
export async function logOutboundMessage(
  submissionId: string,
  companyId: string,
  body: string,
  channel: "sms" | "email",
  externalId?: string
): Promise<PublicReportMessage | null> {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("public_report_messages")
    .insert({
      id: crypto.randomUUID(),
      submission_id: submissionId,
      company_id: companyId,
      direction: "outbound",
      channel,
      body,
      sent_by: userId,
      external_id: externalId ?? null,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? mapMessage(data as MessageRow) : null;
}
