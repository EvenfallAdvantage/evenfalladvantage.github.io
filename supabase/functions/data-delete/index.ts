/**
 * data-delete — GDPR Article 17 right to be forgotten.
 *
 * Anonymizes the subject's PII across all user-owned rows and deactivates
 * their membership in the chosen company (or all companies if not scoped).
 * Strictly destructive — requires the caller to pass a confirmation token
 * that exactly matches the subject's email address.
 *
 * Body:
 *   {
 *     subject_user_id: uuid,
 *     company_id?: uuid,         // optional: scope to one company
 *     confirm_email: string,     // must match subject's email exactly (case-insensitive)
 *   }
 *
 * RBAC:
 *   - Self-request: allowed.
 *   - Else: caller must be owner of the company the subject belongs to.
 *
 * Behaviour:
 *   1. Anonymize users.first_name, last_name, phone, email, avatar_url
 *      (replaced with deterministic stubs to preserve referential integrity).
 *   2. Set company_memberships.status='deleted' for the scoped membership(s).
 *   3. Strip PII from incident_updates.content, task_comments.content where
 *      authored by subject (replaced with "[redacted]").
 *   4. Hard-delete badges (sensitive cred data).
 *   5. Audit-log `data.delete` with full scope metadata.
 *
 * NOTE: incidents, tasks, and other authored work-product rows are KEPT
 * (still referenced by company), but their user_id is nullified where the
 * foreign key allows ON DELETE SET NULL. This is the standard GDPR-vs-
 * business-records balance.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getCallerIp, getCallerUserAgent, logAudit } from "../_shared/audit.ts";

interface DeleteRequest {
  subject_user_id: string;
  company_id?: string;
  confirm_email: string;
}

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

    const body = (await req.json()) as DeleteRequest;
    if (!body.subject_user_id || !body.confirm_email) {
      return new Response(
        JSON.stringify({ error: "subject_user_id and confirm_email required" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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

    // Fetch subject to validate confirmation token.
    const { data: subjectUser } = await admin
      .from("users")
      .select("id, email, first_name, last_name")
      .eq("id", body.subject_user_id)
      .maybeSingle();
    if (!subjectUser) {
      return new Response(JSON.stringify({ error: "Subject not found" }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    if (
      (subjectUser as { email: string | null }).email?.toLowerCase().trim() !==
        body.confirm_email.toLowerCase().trim()
    ) {
      await logAudit(admin, {
        event_type: "data.delete",
        company_id: body.company_id ?? "00000000-0000-0000-0000-000000000000",
        user_id: callerInternalId,
        entity_type: "user",
        entity_id: body.subject_user_id,
        outcome: "blocked",
        ip_address: getCallerIp(req),
        user_agent: getCallerUserAgent(req),
        metadata: { reason: "confirm_email_mismatch" },
      });
      return new Response(
        JSON.stringify({ error: "Confirmation email did not match subject's email" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // RBAC: self or company owner only.
    if (!isSelfRequest) {
      const { data: subjectMems } = await admin
        .from("company_memberships")
        .select("company_id")
        .eq("user_id", body.subject_user_id);
      const subjectCompanyIds = (subjectMems ?? []).map(
        (r: { company_id: string }) => r.company_id,
      );
      const { data: ownerMems } = await admin
        .from("company_memberships")
        .select("company_id, role")
        .eq("user_id", callerInternalId)
        .in("company_id", subjectCompanyIds.length > 0 ? subjectCompanyIds : [""])
        .eq("role", "owner");
      if (!ownerMems || ownerMems.length === 0) {
        await logAudit(admin, {
          event_type: "data.delete",
          company_id: body.company_id ?? subjectCompanyIds[0] ?? "00000000-0000-0000-0000-000000000000",
          user_id: callerInternalId,
          entity_type: "user",
          entity_id: body.subject_user_id,
          outcome: "blocked",
          ip_address: getCallerIp(req),
          user_agent: getCallerUserAgent(req),
          metadata: { reason: "rbac_failed" },
        });
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: jsonHeaders,
        });
      }
    }

    // ── Anonymize PII ────────────────────────────────────────
    const anonSuffix = body.subject_user_id.slice(0, 8);
    const anonEmail = `deleted+${anonSuffix}@anonymized.invalid`;

    // Update users row: only redact PII if FULL deletion (no company_id scope)
    // OR self-request. Otherwise we only deactivate the membership; the user
    // may still belong to other companies and shouldn't lose their identity
    // there.
    const fullDeletion = !body.company_id || isSelfRequest;
    if (fullDeletion) {
      await admin
        .from("users")
        .update({
          first_name: "Redacted",
          last_name: anonSuffix,
          phone: null,
          email: anonEmail,
          avatar_url: null,
        })
        .eq("id", body.subject_user_id);
    }

    // Deactivate membership(s).
    if (body.company_id) {
      await admin
        .from("company_memberships")
        .update({ status: "deleted" })
        .eq("user_id", body.subject_user_id)
        .eq("company_id", body.company_id);
    } else {
      await admin
        .from("company_memberships")
        .update({ status: "deleted" })
        .eq("user_id", body.subject_user_id);
    }

    // Redact authored comment-style content.
    await admin
      .from("incident_updates")
      .update({ content: "[redacted by data-delete request]" })
      .eq("user_id", body.subject_user_id);
    await admin
      .from("task_comments")
      .update({ content: "[redacted by data-delete request]" })
      .eq("user_id", body.subject_user_id);

    // Hard-delete badges (they're personal credentials).
    await admin.from("badges").delete().eq("user_id", body.subject_user_id);

    await logAudit(admin, {
      event_type: "data.delete",
      company_id: body.company_id ?? "00000000-0000-0000-0000-000000000000",
      user_id: callerInternalId,
      entity_type: "user",
      entity_id: body.subject_user_id,
      outcome: "success",
      ip_address: getCallerIp(req),
      user_agent: getCallerUserAgent(req),
      metadata: {
        self: isSelfRequest,
        full_deletion: fullDeletion,
        scope: body.company_id ? "company" : "all_companies",
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        full_deletion: fullDeletion,
        scope: body.company_id ? "company" : "all_companies",
      }),
      { headers: jsonHeaders },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[data-delete] error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
