import { createClient } from "./client";
import { ensureInternalUser } from "./db-helpers";

// ─── Applicants ─────────────────────────────────────────

export async function getApplicants(companyId: string, status?: string) {
  const supabase = createClient();
  let query = supabase
    .from("applicants")
    .select("*, reviewed_by_user:users!applicants_reviewed_by_fkey(first_name, last_name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getApplicant(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("applicants")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createApplicant(companyId: string, applicant: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  guardCardNumber?: string;
  guardCardExpiry?: string;
  workPreferences?: string[];
  availability?: string;
  experience?: string;
  resumeUrl?: string;
  coverLetter?: string;
  source?: string;
  customFields?: Record<string, unknown>;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("applicants")
    .insert({
      id: crypto.randomUUID(),
      company_id: companyId,
      first_name: applicant.firstName,
      last_name: applicant.lastName,
      email: applicant.email,
      phone: applicant.phone ?? null,
      address: applicant.address ?? null,
      guard_card_number: applicant.guardCardNumber ?? null,
      guard_card_expiry: applicant.guardCardExpiry ?? null,
      work_preferences: applicant.workPreferences ?? [],
      availability: applicant.availability ?? null,
      experience: applicant.experience ?? null,
      resume_url: applicant.resumeUrl ?? null,
      cover_letter: applicant.coverLetter ?? null,
      source: applicant.source ?? "overwatch",
      custom_fields: applicant.customFields ?? {},
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateApplicantStatus(id: string, status: string, notes?: string) {
  const userId = await ensureInternalUser();
  const supabase = createClient();
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (notes !== undefined) updates.notes = notes;
  if (userId) {
    updates.reviewed_by = userId;
    updates.reviewed_at = new Date().toISOString();
  }
  if (status === "hired") updates.hired_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("applicants")
    .update(updates)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteApplicant(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("applicants").delete().eq("id", id);
  if (error) throw error;
}

// Convert a hired applicant into a real user + company membership
export async function convertApplicantToUser(applicantId: string, companyId: string) {
  const supabase = createClient();
  const { data: applicant } = await supabase
    .from("applicants")
    .select("*")
    .eq("id", applicantId)
    .maybeSingle();
  if (!applicant) throw new Error("Applicant not found");

  // Check if user with this email already exists
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", applicant.email)
    .maybeSingle();

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
  } else {
    // Create user record (they'll need to register/set password separately)
    const newId = crypto.randomUUID();
    const { error: userErr } = await supabase
      .from("users")
      .insert({
        id: newId,
        email: applicant.email,
        first_name: applicant.first_name,
        last_name: applicant.last_name,
        phone: applicant.phone,
      });
    if (userErr) throw userErr;
    userId = newId;
  }

  // Create company membership with onboarding status
  const { error: memberErr } = await supabase
    .from("company_memberships")
    .upsert({
      id: crypto.randomUUID(),
      user_id: userId,
      company_id: companyId,
      role: "member",
      status: "onboarding",
      guard_card_number: applicant.guard_card_number,
      guard_card_expiry: applicant.guard_card_expiry,
      address: applicant.address,
      work_preferences: applicant.work_preferences ?? [],
      hire_date: new Date().toISOString(),
      onboarding_complete: false,
    }, { onConflict: "user_id,company_id" });
  if (memberErr) throw memberErr;

  // Mark applicant as converted
  await supabase
    .from("applicants")
    .update({ converted_user_id: userId, status: "hired", hired_at: new Date().toISOString() })
    .eq("id", applicantId);

  // Auto-create onboarding progress for all required tasks
  const { data: tasks } = await supabase
    .from("onboarding_tasks")
    .select("id")
    .eq("company_id", companyId);
  if (tasks?.length) {
    await supabase.from("onboarding_progress").insert(
      tasks.map(t => ({
        id: crypto.randomUUID(),
        user_id: userId,
        task_id: t.id,
        completed: false,
      }))
    );
  }

  return { userId };
}

// ─── Onboarding Tasks (admin templates) ─────────────────

export async function getOnboardingTasks(companyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("onboarding_tasks")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createOnboardingTask(companyId: string, task: {
  title: string;
  description?: string;
  category?: string;
  isRequired?: boolean;
  sortOrder?: number;
  autoLink?: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("onboarding_tasks")
    .insert({
      id: crypto.randomUUID(),
      company_id: companyId,
      title: task.title,
      description: task.description ?? null,
      category: task.category ?? "general",
      is_required: task.isRequired ?? true,
      sort_order: task.sortOrder ?? 0,
      auto_link: task.autoLink ?? null,
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateOnboardingTask(taskId: string, updates: {
  title?: string;
  description?: string;
  category?: string;
  isRequired?: boolean;
  sortOrder?: number;
  autoLink?: string;
}) {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.isRequired !== undefined) payload.is_required = updates.isRequired;
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;
  if (updates.autoLink !== undefined) payload.auto_link = updates.autoLink;
  const { data, error } = await supabase
    .from("onboarding_tasks")
    .update(payload)
    .eq("id", taskId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteOnboardingTask(taskId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("onboarding_tasks").delete().eq("id", taskId);
  if (error) throw error;
}

export async function reorderOnboardingTasks(tasks: { id: string; sort_order: number }[]) {
  const supabase = createClient();
  for (const t of tasks) {
    const { error } = await supabase
      .from("onboarding_tasks")
      .update({ sort_order: t.sort_order })
      .eq("id", t.id);
    if (error) throw error;
  }
}

// ─── Onboarding Progress (per-user) ─────────────────────

export async function getMyOnboardingProgress(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("onboarding_progress")
    .select("*, onboarding_tasks(*)")
    .eq("user_id", userId)
    .eq("onboarding_tasks.company_id", companyId);
  if (error) throw error;
  return data ?? [];
}

export async function getUserOnboardingProgress(userId: string, companyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("onboarding_progress")
    .select("*, onboarding_tasks(*)")
    .eq("user_id", userId)
    .eq("onboarding_tasks.company_id", companyId);
  if (error) throw error;
  return data ?? [];
}

export async function toggleOnboardingTask(taskId: string, completed: boolean) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("onboarding_progress")
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function completeOnboarding(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  // Mark membership as active and onboarding complete
  const { error } = await supabase
    .from("company_memberships")
    .update({ onboarding_complete: true, status: "active" })
    .eq("user_id", userId)
    .eq("company_id", companyId);
  if (error) throw error;
}

// ─── Integrations Config ────────────────────────────────

export async function getIntegrationsConfig(companyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("integrations_config")
    .select("*")
    .eq("company_id", companyId);
  if (error) throw error;
  return data ?? [];
}

export async function saveIntegrationConfig(companyId: string, provider: string, config: Record<string, unknown>, isActive: boolean) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("integrations_config")
    .upsert({
      company_id: companyId,
      provider,
      config,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_id,provider" })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Enhanced Profile (membership fields) ───────────────

export async function updateMemberProfile(companyId: string, updates: {
  guardCardNumber?: string;
  guardCardExpiry?: string;
  address?: string;
  bio?: string;
  workPreferences?: string[];
  shirtSize?: string;
  jacketSize?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  whatsappOptedIn?: boolean;
  hideContactFromRoster?: boolean;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.guardCardNumber !== undefined) payload.guard_card_number = updates.guardCardNumber;
  if (updates.guardCardExpiry !== undefined) payload.guard_card_expiry = updates.guardCardExpiry;
  if (updates.address !== undefined) payload.address = updates.address;
  if (updates.bio !== undefined) payload.bio = updates.bio;
  if (updates.workPreferences !== undefined) payload.work_preferences = updates.workPreferences;
  if (updates.shirtSize !== undefined) payload.shirt_size = updates.shirtSize;
  if (updates.jacketSize !== undefined) payload.jacket_size = updates.jacketSize;
  if (updates.emergencyContactName !== undefined) payload.emergency_contact_name = updates.emergencyContactName;
  if (updates.emergencyContactPhone !== undefined) payload.emergency_contact_phone = updates.emergencyContactPhone;
  if (updates.whatsappOptedIn !== undefined) payload.whatsapp_opted_in = updates.whatsappOptedIn;
  if (updates.hideContactFromRoster !== undefined) payload.hide_contact_roster = updates.hideContactFromRoster;
  const { data, error } = await supabase
    .from("company_memberships")
    .update(payload)
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMemberProfile(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("company_memberships")
    .select("*")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCompanyReadiness(companyId: string) {
  const supabase = createClient();

  // 1. All memberships with profile fields
  const { data: members } = await supabase
    .from("company_memberships")
    .select("id, user_id, role, bio, address, guard_card_number, guard_card_expiry, emergency_contact_name, emergency_contact_phone, work_preferences, shirt_size, jacket_size")
    .eq("company_id", companyId)
    .eq("status", "active");

  // 2. All required KB documents in this company
  const { data: requiredDocs, error: reqDocsErr } = await supabase
    .from("kb_documents")
    .select("id, title, folder_id, kb_folders!inner(company_id)")
    .eq("required", true)
    .eq("kb_folders.company_id", companyId);
  if (reqDocsErr) console.error("[Readiness] kb_documents query failed:", reqDocsErr);

  // 3. All read records for those required docs
  const reqDocIds = (requiredDocs ?? []).map((d: { id: string }) => d.id);
  let readRecords: { document_id: string; user_id: string }[] = [];
  if (reqDocIds.length > 0) {
    const { data: reads, error: readsErr } = await supabase
      .from("kb_document_reads")
      .select("document_id, user_id")
      .in("document_id", reqDocIds);
    if (readsErr) console.error("[Readiness] kb_document_reads query failed:", readsErr);
    readRecords = reads ?? [];
  }

  // Build readiness map: membershipId → { profileIssues, requiredReadingMissing }
  const readByUser = new Map<string, Set<string>>();
  for (const r of readRecords) {
    if (!readByUser.has(r.user_id)) readByUser.set(r.user_id, new Set());
    readByUser.get(r.user_id)!.add(r.document_id);
  }

  const PROFILE_FIELDS: { key: string; label: string }[] = [
    { key: "bio", label: "Bio" },
    { key: "address", label: "Address" },
    { key: "guard_card_number", label: "Guard Card" },
    { key: "emergency_contact_name", label: "Emergency Contact Name" },
    { key: "emergency_contact_phone", label: "Emergency Contact Phone" },
    { key: "work_preferences", label: "Work Preferences" },
  ];

  const result: Record<string, { profileMissing: string[]; readingMissing: { id: string; title: string }[] }> = {};
  for (const m of (members ?? [])) {
    const profileMissing: string[] = [];
    for (const f of PROFILE_FIELDS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const val = (m as any)[f.key];
      if (!val || (Array.isArray(val) && val.length === 0)) profileMissing.push(f.label);
    }

    const userReads = readByUser.get(m.user_id) ?? new Set();
    const readingMissing = (requiredDocs ?? [])
      .filter((d: { id: string }) => !userReads.has(d.id))
      .map((d: { id: string; title: string }) => ({ id: d.id, title: d.title }));

    result[m.id] = { profileMissing, readingMissing };
  }

  return result;
}

export async function getMemberProfileById(membershipId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("company_memberships")
    .select("*, users(id, first_name, last_name, email, phone, avatar_url)")
    .eq("id", membershipId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
