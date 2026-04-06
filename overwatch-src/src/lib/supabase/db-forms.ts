import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";
import type { FormPayload } from "@/types";

// ─── Forms (Field Reports) ─────────────────────────────

export async function getForms(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("forms")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function createForm(params: {
  companyId: string;
  name: string;
  description?: string;
  fields?: unknown[];
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("forms")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      description: params.description ?? null,
      fields: params.fields ?? [],
      ...ts(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateForm(formId: string, updates: { fields?: unknown[]; name?: string; description?: string }) {
  const supabase = createClient();
  const payload: FormPayload = { updated_at: new Date().toISOString() };
  if (updates.fields !== undefined) payload.fields = updates.fields;
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description;
  const { data, error } = await supabase.from("forms").update(payload).eq("id", formId).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteForm(formId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("forms").delete().eq("id", formId);
  if (error) throw error;
}

export async function getFormSubmissions(formId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("form_submissions")
    .select("*, users(first_name, last_name)")
    .eq("form_id", formId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function submitForm(params: {
  formId: string;
  data: Record<string, unknown>;
  shiftId?: string;
  eventId?: string;
  timesheetId?: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("form_submissions")
    .insert({
      id: crypto.randomUUID(),
      form_id: params.formId,
      user_id: userId,
      data: params.data,
      shift_id: params.shiftId ?? null,
      event_id: params.eventId ?? null,
      timesheet_id: params.timesheetId ?? null,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── All form submissions for company (admin) ───────

export async function getAllFormSubmissions(companyId: string) {
  const supabase = createClient();

  // Step 1: Get all form IDs for this company
  const { data: companyForms, error: formsError } = await supabase
    .from("forms")
    .select("id, name")
    .eq("company_id", companyId);

  const formIds = (companyForms ?? []).map((f: { id: string }) => f.id);
  if (formIds.length === 0) return [];

  // Step 2: Get all submissions for those forms
  const { data, error: subsError } = await supabase
    .from("form_submissions")
    .select("*, users!form_submissions_user_id_fkey(first_name, last_name, avatar_url), forms(name), events(id, name)")
    .in("form_id", formIds)
    .order("created_at", { ascending: false });

  if (subsError) console.error("[getAllFormSubmissions] error:", subsError);
  return data ?? [];
}

export async function getEventFormSubmissions(eventId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("form_submissions")
    .select("*, users(first_name, last_name, avatar_url), forms(name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// ─── Form submissions by user (for Profile tab) ─────

export async function getUserFormSubmissions() {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("form_submissions")
    .select("*, forms(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

// ─── Form submission review (admin) ──────────────────

export async function reviewFormSubmission(submissionId: string, note: string) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("form_submissions")
    .update({ status: "reviewed", reviewed_by_id: userId, reviewed_at: new Date().toISOString(), review_note: note })
    .eq("id", submissionId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Edit form submission (with change log) ──────────

export async function editFormSubmission(
  submissionId: string,
  newData: Record<string, unknown>,
  reason?: string,
) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();

  // Get current data for change log
  const { data: current } = await supabase
    .from("form_submissions")
    .select("data, change_log")
    .eq("id", submissionId)
    .single();

  // Build change log entry
  const oldData = (current?.data ?? {}) as Record<string, unknown>;
  const changes: { field: string; from: string; to: string }[] = [];
  for (const key of Object.keys(newData)) {
    if (String(oldData[key] ?? "") !== String(newData[key] ?? "")) {
      changes.push({ field: key, from: String(oldData[key] ?? ""), to: String(newData[key] ?? "") });
    }
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    user_id: userId,
    action: "edit",
    reason: reason ?? "",
    changes,
  };

  const existingLog = Array.isArray(current?.change_log) ? current.change_log : [];

  const { data, error } = await supabase
    .from("form_submissions")
    .update({
      data: newData,
      change_log: [...existingLog, logEntry],
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Delete form submission ──────────────────────────

export async function deleteFormSubmission(submissionId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("form_submissions")
    .delete()
    .eq("id", submissionId);
  if (error) throw error;
}
