import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = { updated_at: new Date().toISOString() };
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
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
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
