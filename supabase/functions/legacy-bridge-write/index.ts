/**
 * legacy-bridge-write (Edge Function, deployed to the LEGACY EADB project
 * vaagvairvwmgyzsmymhs).
 *
 * Server-side path for the writes Overwatch's Instructor HQ and legacy
 * account auto-linking make to EADB. Today those go straight from the browser
 * with the EADB anon key, which only works because EADB has anon INSERT /
 * UPDATE / DELETE policies on 10 tables. Once Overwatch uses this function,
 * migrations/eadb/20261006120500_eadb_remove_anon_writes.sql can be applied.
 *
 * Auth (verify_jwt = false; the caller's JWT belongs to OverwatchDB, not EADB):
 *   1. `Authorization: Bearer <Overwatch access token>` is verified by calling
 *      Overwatch's GoTrue (`/auth/v1/user`). Gives the caller's uid + email.
 *   2. For instructor ops, `x-overwatch-company: <company id>` and the same
 *      token are used to read the caller's role in that company
 *      (`rpc/my_company_role`, RLS-scoped to the caller) and
 *      `companies.is_training_provider`. Rule = canManageLegacyCourses():
 *      training provider AND (instructor OR admin+). The client can't fake
 *      either: both reads run as the caller against OverwatchDB.
 *   3. Writes then run with this project's service role, limited to the
 *      operation allowlist in lib.ts (fixed table, fixed columns, typed and
 *      size-checked values). student.ensure / instructor.ensure only ever
 *      act on the caller's own uid and email.
 *
 * Secrets (set on EADB): OVERWATCH_SUPABASE_URL, OVERWATCH_SUPABASE_ANON_KEY.
 * OverwatchDB's legacy JWT keys are disabled, so the "anon key" is a
 * publishable key: the `default` one (sb_publishable_BYuOl…), the same key the
 * live Overwatch frontend ships. It is only ever sent as the `apikey` header;
 * the caller's own token is the Bearer. Don't disable that key without
 * updating this secret. Optional: LEGACY_BRIDGE_ALLOWED_ORIGINS.
 * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
 *
 * Request:  POST { op: string, args?: { keys?: {...}, values?: {...} } }
 * Response: 200 { ok: true, id?: string, data?: unknown }   (data: assessment.get_questions)
 *           400 invalid input, 401 no/invalid Overwatch session,
 *           403 not allowed / bad origin, 404 unknown op, 409 conflict, 500.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  OPS, certificateCodes, corsHeaders, isAllowed, isUuid, nextTotalQuestions, originAllowed, questionRows,
  rowsToQuestions, validateArgs, type Question,
} from "./lib.ts";

const MAX_BODY = 256 * 1024;

type Caller = { id: string; email: string };

async function verifyOverwatchUser(owUrl: string, owAnon: string, token: string): Promise<Caller | null> {
  const r = await fetch(`${owUrl}/auth/v1/user`, { headers: { apikey: owAnon, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  if (!u || !isUuid(u.id) || typeof u.email !== "string" || !u.email) return null;
  return { id: u.id, email: u.email.toLowerCase() };
}

async function overwatchContext(owUrl: string, owAnon: string, token: string, companyId: string) {
  const headers = { apikey: owAnon, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const [roleRes, coRes] = await Promise.all([
    fetch(`${owUrl}/rest/v1/rpc/my_company_role`, { method: "POST", headers, body: JSON.stringify({ p_company_id: companyId }) }),
    fetch(`${owUrl}/rest/v1/companies?id=eq.${companyId}&select=is_training_provider`, { headers }),
  ]);
  const role = roleRes.ok ? await roleRes.json().catch(() => null) : null;
  const rows = coRes.ok ? await coRes.json().catch(() => []) : [];
  return {
    role: typeof role === "string" ? role : null,
    isTrainingProvider: Array.isArray(rows) && rows[0]?.is_training_provider === true,
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const extraOrigins = Deno.env.get("LEGACY_BRIDGE_ALLOWED_ORIGINS");
  const cors = corsHeaders(origin, extraOrigins);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { status: originAllowed(origin, extraOrigins) ? 200 : 403, headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!originAllowed(origin, extraOrigins)) return json({ error: "origin_not_allowed" }, 403);

  const owUrl = Deno.env.get("OVERWATCH_SUPABASE_URL") ?? "";
  const owAnon = Deno.env.get("OVERWATCH_SUPABASE_ANON_KEY") ?? "";
  if (!owUrl || !owAnon) return json({ error: "bridge_not_configured" }, 503);

  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!m) return json({ error: "missing_session" }, 401);
  const token = m[1];

  if (Number(req.headers.get("content-length") ?? "0") > MAX_BODY) return json({ error: "payload_too_large" }, 413);
  let body: { op?: unknown; args?: unknown };
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return json({ error: "payload_too_large" }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const op = typeof body?.op === "string" ? body.op : "";
  const spec = Object.prototype.hasOwnProperty.call(OPS, op) ? OPS[op] : undefined;
  if (!spec) return json({ error: "unknown_op" }, 404);

  const caller = await verifyOverwatchUser(owUrl, owAnon, token);
  if (!caller) return json({ error: "invalid_session" }, 401);

  let ctx = { role: null as string | null, isTrainingProvider: false };
  if (spec.permission !== "self") {
    const companyId = req.headers.get("x-overwatch-company") ?? "";
    if (!isUuid(companyId)) return json({ error: "missing_company" }, 400);
    ctx = await overwatchContext(owUrl, owAnon, token, companyId);
  }
  if (!isAllowed(spec.permission, ctx)) return json({ error: "forbidden" }, 403);

  const v = validateArgs(spec, body.args ?? {});
  if (!v.ok) return json({ error: v.error }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const fail = (error: { code?: string; message?: string } | null) => {
    console.error(`[legacy-bridge-write] ${op} by ${caller.id}:`, error?.code, error?.message);
    return json({ error: error?.code === "23505" ? "conflict" : "write_failed", code: error?.code ?? null }, error?.code === "23505" ? 409 : 500);
  };

  try {
    switch (op) {
      case "student.ensure": {
        const { data: found } = await db.from("students").select("id").eq("email", caller.email).maybeSingle();
        if (found) return json({ ok: true, id: found.id });
        const { error } = await db.from("students").upsert({
          id: caller.id, email: caller.email,
          first_name: (v.values.first_name as string) ?? "", last_name: (v.values.last_name as string) ?? "",
        }, { onConflict: "id" });
        if (error && error.code !== "23505") return fail(error);
        await db.from("student_profiles").upsert({ student_id: caller.id }, { onConflict: "student_id", ignoreDuplicates: true });
        return json({ ok: true, id: caller.id });
      }
      case "instructor.ensure": {
        const { data: found } = await db.from("instructors").select("id").eq("email", caller.email).maybeSingle();
        if (found) return json({ ok: true, id: found.id });
        const { data, error } = await db.from("instructors").insert({
          id: caller.id, email: caller.email,
          first_name: (v.values.first_name as string) ?? "", last_name: (v.values.last_name as string) ?? "", is_active: true,
        }).select("id").single();
        if (error) return fail(error);
        return json({ ok: true, id: data.id });
      }
      case "course.delete": {
        const id = v.keys.id as string;
        const count = async (table: string) => {
          const { count: n, error } = await db.from(table).select("course_id", { count: "exact", head: true }).eq("course_id", id);
          if (error) throw new Error(`${table}: ${error.message}`);
          return n ?? 0;
        };
        const [enrollments, payments, reviews] = await Promise.all([
          count("student_course_enrollments"), count("payment_transactions"), count("course_reviews"),
        ]);
        if (enrollments + payments + reviews > 0) {
          return json({ error: "course_in_use", enrollments, payments, reviews }, 409);
        }
        const { data, error } = await db.from("courses").delete().eq("id", id).select("id");
        if (error) return fail(error);
        if (!data?.length) return json({ error: "not_found" }, 404);
        console.log(`[legacy-bridge-write] course.delete ${id} by ${caller.id}`);
        return json({ ok: true });
      }
      case "assessment.get_questions": {
        const id = v.keys.id as string;
        const { data: a, error: aErr } = await db.from("assessments").select("id, questions_json").eq("id", id).maybeSingle();
        if (aErr) return fail(aErr);
        if (!a) return json({ error: "not_found" }, 404);
        const { data: rows, error } = await db.from("assessment_questions").select("*").eq("assessment_id", id);
        if (error) return fail(error);
        const fromJson = Array.isArray(a.questions_json) ? a.questions_json : [];
        const questions = rows?.length ? rowsToQuestions(rows) : fromJson;
        return json({ ok: true, data: { questions, source: rows?.length ? "rows" : "json" } });
      }
      case "assessment.set_questions": {
        const id = v.keys.id as string;
        const qs = v.values.questions as Question[];
        const { data: a, error: aErr } = await db.from("assessments").select("id, total_questions").eq("id", id).maybeSingle();
        if (aErr) return fail(aErr);
        if (!a) return json({ error: "not_found" }, 404);
        // Upsert 1..n first, then trim the tail, so there is never a moment
        // with no questions (PostgREST gives no multi-statement transaction).
        const { error: upErr } = await db.from("assessment_questions")
          .upsert(questionRows(id, qs), { onConflict: "assessment_id,question_number" });
        if (upErr) return fail(upErr);
        const { error: delErr } = await db.from("assessment_questions").delete().eq("assessment_id", id).gt("question_number", qs.length);
        if (delErr) return fail(delErr);
        const { error: updErr } = await db.from("assessments").update({
          questions_json: qs, total_questions: nextTotalQuestions(a.total_questions, qs.length), updated_at: new Date().toISOString(),
        }).eq("id", id);
        if (updErr) return fail(updErr);
        return json({ ok: true });
      }
      case "certificate.issue": {
        // issued_by = the caller's own instructor record, never a client value.
        let { data: inst } = await db.from("instructors").select("id").eq("id", caller.id).maybeSingle();
        if (!inst) ({ data: inst } = await db.from("instructors").select("id").eq("email", caller.email).maybeSingle());
        if (!inst) return json({ error: "not_an_instructor" }, 403);
        const { data, error } = await db.from("certificates").insert({
          ...v.values, ...certificateCodes(), issued_by: inst.id,
          issue_date: new Date().toISOString().split("T")[0], status: "active",
        }).select("id").single();
        if (error) return fail(error);
        return json({ ok: true, id: data.id });
      }
    }

    const table = spec.table!;
    if (spec.kind === "insert") {
      const row = { ...(spec.fallbacks ?? {}), ...v.values, ...(spec.defaults ?? {}) };
      const { data, error } = await db.from(table).insert(row).select("id").single();
      if (error) return fail(error);
      return json({ ok: true, id: data.id });
    }
    if (spec.kind === "upsert") {
      const { error } = await db.from(table).upsert({ ...v.keys, ...v.values, ...(spec.defaults ?? {}) }, { onConflict: spec.onConflict });
      if (error) return fail(error);
      return json({ ok: true });
    }
    let q = spec.kind === "update" ? db.from(table).update(v.values) : db.from(table).delete();
    for (const [k, val] of Object.entries(v.keys)) q = q.eq(k, val);
    const { error } = await q;
    if (error) return fail(error);
    return json({ ok: true });
  } catch (err) {
    console.error(`[legacy-bridge-write] ${op} crashed:`, err instanceof Error ? err.message : String(err));
    return json({ error: "write_failed" }, 500);
  }
});
