/**
 * data-export — GDPR Article 15/20 data portability bundle.
 *
 * The caller (user JWT) requests a complete export of their own personal
 * data across all Overwatch tables, OR a company owner requests an export
 * for one of their members (subject access request). Returns a single JSON
 * bundle suitable for download.
 *
 * Body:
 *   {
 *     subject_user_id: uuid,    // the user whose data to export
 *     company_id?: uuid,        // optional: scope to one company; otherwise all companies the subject belongs to
 *   }
 *
 * RBAC:
 *   - If subject_user_id == caller: allowed (self-export).
 *   - Else: caller must be owner of the company the subject belongs to.
 *
 * Output shape:
 *   {
 *     generated_at, subject: { id, email, first_name, last_name, phone, avatar_url, created_at },
 *     companies: Array<{ id, name, role, joined_at }>,
 *     timesheets, incidents_reported, incidents_assigned, incident_updates,
 *     tasks_created, tasks_assigned, task_comments, task_watchers, task_checklist_items,
 *     audit_logs (caller-only), patrols, form_submissions, leave_requests,
 *     time_change_requests, badges
 *   }
 *
 * Audit-logs `data.export` with outcome=success and metadata.subject_user_id.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getCallerIp, getCallerUserAgent, logAudit } from "../_shared/audit.ts";

interface ExportRequest {
  subject_user_id: string;
  company_id?: string;
}

// Tables we export. Each entry lists how to scope to a single user. For
// company-scoped tables we also constrain by company_id when provided.
const USER_OWNED_QUERIES: Array<{
  table: string;
  filterCol: string;
  companyCol?: string;
}> = [
  { table: "timesheets", filterCol: "user_id", companyCol: "company_id" },
  { table: "incidents", filterCol: "reported_by", companyCol: "company_id" },
  { table: "incidents", filterCol: "assigned_to", companyCol: "company_id" },
  { table: "incident_updates", filterCol: "user_id" },
  { table: "tasks", filterCol: "created_by", companyCol: "company_id" },
  { table: "tasks", filterCol: "assigned_to", companyCol: "company_id" },
  { table: "task_comments", filterCol: "user_id" },
  { table: "task_watchers", filterCol: "user_id" },
  { table: "audit_logs", filterCol: "user_id", companyCol: "company_id" },
  { table: "patrol_logs", filterCol: "user_id", companyCol: "company_id" },
  { table: "form_submissions", filterCol: "submitted_by", companyCol: "company_id" },
  { table: "time_off_requests", filterCol: "user_id", companyCol: "company_id" },
  { table: "time_change_requests", filterCol: "user_id" },
  { table: "badges", filterCol: "user_id" },
];

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const jsonHeaders = { ...cors, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const body = (await req.json()) as ExportRequest;
    if (!body.subject_user_id) {
      return new Response(JSON.stringify({ error: "subject_user_id required" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Look up caller's internal user id.
    const { data: callerRow } = await admin
      .from("users")
      .select("id")
      .eq("supabase_id", caller.id)
      .maybeSingle();
    const callerInternalId = (callerRow as { id?: string } | null)?.id ?? null;
    if (!callerInternalId) {
      return new Response(JSON.stringify({ error: "Caller has no internal user record" }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    const isSelfRequest = callerInternalId === body.subject_user_id;

    // RBAC: self-request always allowed; otherwise caller must be owner of
    // a company the subject is in.
    if (!isSelfRequest) {
      const { data: subjectMems } = await admin
        .from("company_memberships")
        .select("company_id")
        .eq("user_id", body.subject_user_id);
      const subjectCompanyIds = (subjectMems ?? []).map(
        (r: { company_id: string }) => r.company_id,
      );
      if (subjectCompanyIds.length === 0) {
        return new Response(JSON.stringify({ error: "Subject not found" }), {
          status: 404,
          headers: jsonHeaders,
        });
      }
      const { data: callerOwnerMems } = await admin
        .from("company_memberships")
        .select("company_id, role")
        .eq("user_id", callerInternalId)
        .in("company_id", subjectCompanyIds)
        .eq("role", "owner");
      if (!callerOwnerMems || callerOwnerMems.length === 0) {
        await logAudit(admin, {
          event_type: "data.export",
          company_id: body.company_id ?? subjectCompanyIds[0],
          user_id: callerInternalId,
          entity_type: "user",
          entity_id: body.subject_user_id,
          outcome: "blocked",
          ip_address: getCallerIp(req),
          user_agent: getCallerUserAgent(req),
          metadata: { reason: "rbac_failed", self: false },
        });
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: jsonHeaders,
        });
      }
    }

    // ── Build bundle ─────────────────────────────────────────
    const { data: subjectUser } = await admin
      .from("users")
      .select("id, supabase_id, email, first_name, last_name, phone, avatar_url, created_at")
      .eq("id", body.subject_user_id)
      .maybeSingle();

    if (!subjectUser) {
      return new Response(JSON.stringify({ error: "Subject not found" }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    const { data: companies } = await admin
      .from("company_memberships")
      .select("company_id, role, status, created_at, companies(name)")
      .eq("user_id", body.subject_user_id);

    const sections: Record<string, unknown> = {};
    for (const q of USER_OWNED_QUERIES) {
      const key = `${q.table}__${q.filterCol}`;
      let query = admin
        .from(q.table)
        .select("*")
        .eq(q.filterCol, body.subject_user_id);
      if (body.company_id && q.companyCol) {
        query = query.eq(q.companyCol, body.company_id);
      }
      const { data, error } = await query;
      sections[key] = error ? { error: error.message } : data ?? [];
    }

    const bundle = {
      generated_at: new Date().toISOString(),
      subject: subjectUser,
      caller_user_id: callerInternalId,
      self_request: isSelfRequest,
      company_id: body.company_id ?? null,
      companies: companies ?? [],
      data: sections,
    };

    // Audit.
    await logAudit(admin, {
      event_type: "data.export",
      company_id: body.company_id ?? ((companies?.[0] as { company_id?: string })?.company_id ?? "00000000-0000-0000-0000-000000000000"),
      user_id: callerInternalId,
      entity_type: "user",
      entity_id: body.subject_user_id,
      outcome: "success",
      ip_address: getCallerIp(req),
      user_agent: getCallerUserAgent(req),
      metadata: {
        self: isSelfRequest,
        sections: Object.keys(sections),
      },
    });

    return new Response(JSON.stringify(bundle), { headers: jsonHeaders });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[data-export] error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
