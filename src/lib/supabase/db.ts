import { createClient } from "./client";

// Helper: generate timestamps for INSERTs (DB defaults don't fire via PostgREST)
function ts() {
  const now = new Date().toISOString();
  return { created_at: now, updated_at: now };
}

// ─── Helper: get current Supabase auth user ID ─────────
async function getAuthUserId() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Helper: get or create internal user ID from auth user
async function ensureInternalUser() {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  // Try to find existing user
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("supabase_id", authUser.id)
    .maybeSingle();

  if (existing) return existing.id;

  // Auto-create user record from auth metadata
  const meta = authUser.user_metadata || {};
  const newId = crypto.randomUUID();
  const { data: created, error } = await supabase
    .from("users")
    .insert({
      id: newId,
      supabase_id: authUser.id,
      email: authUser.email ?? null,
      phone: authUser.phone ?? meta.phone ?? null,
      first_name: meta.first_name ?? "",
      last_name: meta.last_name ?? "",
      ...ts(),
    })
    .select("id")
    .single();

  if (error) {
    console.warn("Auto-create user failed:", error.message);
    return null;
  }
  return created.id;
}

// ─── Users ──────────────────────────────────────────────

export async function upsertUser(data: {
  supabaseId: string;
  email?: string | null;
  phone?: string | null;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}) {
  const supabase = createClient();
  const { data: user, error } = await supabase
    .from("users")
    .upsert(
      {
        id: crypto.randomUUID(),
        supabase_id: data.supabaseId,
        email: data.email ?? null,
        phone: data.phone ?? null,
        first_name: data.firstName,
        last_name: data.lastName,
        avatar_url: data.avatarUrl ?? null,
        ...ts(),
      },
      { onConflict: "supabase_id", ignoreDuplicates: false }
    )
    .select()
    .maybeSingle();

  if (error) throw error;
  return user;
}

export async function fetchUserProfile() {
  const authId = await getAuthUserId();
  if (!authId) return null;

  const supabase = createClient();

  // Get user record (or auto-create if missing)
  let { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("supabase_id", authId)
    .maybeSingle();

  if (!user) {
    // Auto-create from auth metadata
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;
    const meta = authUser.user_metadata || {};
    const newId = crypto.randomUUID();
    const { data: created } = await supabase
      .from("users")
      .insert({
        id: newId,
        supabase_id: authId,
        email: authUser.email ?? null,
        phone: authUser.phone ?? meta.phone ?? null,
        first_name: meta.first_name ?? "",
        last_name: meta.last_name ?? "",
        ...ts(),
      })
      .select("*")
      .maybeSingle();
    if (!created) return null;
    user = created;
  }

  // Get memberships with company info
  const { data: memberships } = await supabase
    .from("company_memberships")
    .select(
      `
      id,
      role,
      nickname,
      status,
      company_id,
      companies (
        id,
        name,
        slug,
        logo_url,
        brand_color,
        join_code
      )
    `
    )
    .eq("user_id", user.id);

  return { user, memberships: memberships ?? [] };
}

// ─── Companies ──────────────────────────────────────────

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createCompany(data: {
  name: string;
  brandColor?: string;
}) {
  const supabase = createClient();
  const slug = data.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const { data: company, error } = await supabase
    .from("companies")
    .insert({
      id: crypto.randomUUID(),
      name: data.name,
      slug,
      join_code: generateJoinCode(),
      brand_color: data.brandColor ?? "#1d3451",
      timezone: "America/Los_Angeles",
      settings: {},
      ...ts(),
    })
    .select()
    .single();

  if (error) throw error;
  return company;
}

export async function findCompanyByJoinCode(code: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("join_code", code.toUpperCase().trim())
    .single();

  if (error) return null;
  return data;
}

// ─── Memberships ────────────────────────────────────────

export async function createMembership(data: {
  userId: string;
  companyId: string;
  role?: string;
}) {
  const supabase = createClient();
  const { data: membership, error } = await supabase
    .from("company_memberships")
    .insert({
      id: crypto.randomUUID(),
      user_id: data.userId,
      company_id: data.companyId,
      role: data.role ?? "staff",
      status: "active",
      work_preferences: [],
      notification_days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      ...ts(),
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return membership;
}

// ─── Full registration flow ─────────────────────────────

export async function registerUserInDB(params: {
  supabaseId: string;
  email?: string | null;
  phone?: string | null;
  firstName: string;
  lastName: string;
  companyName: string;
}) {
  // 1. Create user record
  const user = await upsertUser({
    supabaseId: params.supabaseId,
    email: params.email,
    phone: params.phone,
    firstName: params.firstName,
    lastName: params.lastName,
  });

  // 2. Create company
  const company = await createCompany({ name: params.companyName });

  // 3. Create membership as owner
  const membership = await createMembership({
    userId: user.id,
    companyId: company.id,
    role: "owner",
  });

  return { user, company, membership };
}

// ─── Timesheets (Watch Log) ──────────────────────────────

export async function getActiveTimesheet() {
  const userId = await ensureInternalUser();
  if (!userId) return null;

  const supabase = createClient();
  const { data } = await supabase
    .from("timesheets")
    .select("*")
    .eq("user_id", userId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function clockIn() {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createClient();

  const { data, error } = await supabase
    .from("timesheets")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      clock_in: new Date().toISOString(),
      clock_method: "app",
      ...ts(),
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function clockOut(timesheetId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("timesheets")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", timesheetId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getRecentTimesheets(limit = 10) {
  const userId = await ensureInternalUser();
  if (!userId) return [];

  const supabase = createClient();

  const { data } = await supabase
    .from("timesheets")
    .select("*")
    .eq("user_id", userId)
    .order("clock_in", { ascending: false })
    .limit(limit);

  return data ?? [];
}

// ─── Roster (Directory) ─────────────────────────────────

export async function getCompanyMembers(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("company_memberships")
    .select(
      `
      id, role, nickname, status, title,
      users (
        id, first_name, last_name, email, phone, avatar_url
      )
    `
    )
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("role", { ascending: true });

  return data ?? [];
}

// ─── Posts (Briefing) ───────────────────────────────────

export async function getPosts(companyId: string, limit = 20) {
  const supabase = createClient();
  const { data } = await supabase
    .from("posts")
    .select(
      `
      id, type, title, content, is_pinned, created_at,
      users (id, first_name, last_name, avatar_url)
    `
    )
    .eq("company_id", companyId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function createPost(data: {
  companyId: string;
  content: string;
  title?: string;
  type?: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createClient();

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      id: crypto.randomUUID(),
      company_id: data.companyId,
      user_id: userId,
      content: data.content,
      title: data.title ?? null,
      type: data.type ?? "update",
      ...ts(),
    })
    .select(
      `
      id, type, title, content, is_pinned, created_at,
      users (id, first_name, last_name, avatar_url)
    `
    )
    .maybeSingle();

  if (error) throw error;
  return post;
}

// ─── Profile update ─────────────────────────────────────

export async function updateUserProfile(updates: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
}) {
  // Ensure user exists first
  await ensureInternalUser();
  const authId = await getAuthUserId();
  if (!authId) throw new Error("Not authenticated");

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {};
  if (updates.firstName !== undefined) payload.first_name = updates.firstName;
  if (updates.lastName !== undefined) payload.last_name = updates.lastName;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;

  const { data, error } = await supabase
    .from("users")
    .update(payload)
    .eq("supabase_id", authId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

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

// ─── Quizzes (Drills) ──────────────────────────────────

export async function getQuizzes(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("quizzes")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function createQuiz(params: {
  companyId: string;
  title: string;
  description?: string;
  questions?: unknown[];
  passingScore?: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quizzes")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      title: params.title,
      description: params.description ?? null,
      questions: params.questions ?? [],
      passing_score: params.passingScore ?? 70,
      ...ts(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Knowledge Base (Field Manual) ─────────────────────

export async function getKBFolders(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("kb_folders")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function getKBDocuments(folderId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("kb_documents")
    .select("*, users(first_name, last_name)")
    .eq("folder_id", folderId)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function createKBFolder(params: {
  companyId: string;
  name: string;
  parentId?: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("kb_folders")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      parent_id: params.parentId ?? null,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createKBDocument(params: {
  folderId: string;
  title: string;
  content?: string;
  fileUrl?: string;
  type?: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("kb_documents")
    .insert({
      id: crypto.randomUUID(),
      folder_id: params.folderId,
      title: params.title,
      content: params.content ?? null,
      file_url: params.fileUrl ?? null,
      type: params.type ?? "page",
      created_by_id: userId,
      ...ts(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Chat Channels (Comms) ─────────────────────────────

export async function getChatChannels(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("chat_channels")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_archived", false)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function createChatChannel(params: {
  companyId: string;
  name: string;
  description?: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chat_channels")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      description: params.description ?? null,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getChatMessages(channelId: string, limit = 50) {
  const supabase = createClient();
  const { data } = await supabase
    .from("chat_messages")
    .select("*, users(id, first_name, last_name, avatar_url)")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).reverse();
}

export async function sendChatMessage(params: {
  channelId: string;
  content: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      id: crypto.randomUUID(),
      channel_id: params.channelId,
      user_id: userId,
      content: params.content,
      created_at: new Date().toISOString(),
    })
    .select("*, users(id, first_name, last_name, avatar_url)")
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Events (Operations) ──────────────────────────────

export async function getEvents(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("events")
    .select("*, clients(name)")
    .eq("company_id", companyId)
    .order("start_date", { ascending: true });
  return data ?? [];
}

export async function createEvent(params: {
  companyId: string;
  name: string;
  description?: string;
  location?: string;
  startDate: string;
  endDate: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      description: params.description ?? null,
      location: params.location ?? null,
      start_date: params.startDate,
      end_date: params.endDate,
      status: "draft",
      ...ts(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Assets (Armory) ──────────────────────────────────

export async function getAssets(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("assets")
    .select("*, users(first_name, last_name)")
    .eq("company_id", companyId)
    .order("name", { ascending: true });
  return data ?? [];
}

export async function createAsset(params: {
  companyId: string;
  name: string;
  assetType?: string;
  serialNumber?: string;
}) {
  const supabase = createClient();
  const qrCode = `ASSET-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const { data, error } = await supabase
    .from("assets")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      asset_type: params.assetType ?? null,
      serial_number: params.serialNumber ?? null,
      qr_code: qrCode,
      ...ts(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Time Off ─────────────────────────────────────────

export async function getTimeOffRequests() {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("time_off_requests")
    .select("*, time_off_policies(name, type)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// ─── Company settings ─────────────────────────────────

export async function getCompanyDetails(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();
  return data;
}

export async function updateCompany(companyId: string, updates: {
  name?: string;
  brandColor?: string;
  timezone?: string;
  logoUrl?: string;
}) {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.brandColor !== undefined) payload.brand_color = updates.brandColor;
  if (updates.timezone !== undefined) payload.timezone = updates.timezone;
  if (updates.logoUrl !== undefined) payload.logo_url = updates.logoUrl;
  const { data, error } = await supabase
    .from("companies")
    .update(payload)
    .eq("id", companyId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Join company flow ──────────────────────────────────

export async function joinCompanyByCode(params: {
  supabaseId: string;
  email?: string | null;
  phone?: string | null;
  firstName: string;
  lastName: string;
  joinCode: string;
}) {
  // 1. Find company
  const company = await findCompanyByJoinCode(params.joinCode);
  if (!company) throw new Error("Invalid company code");

  // 2. Upsert user
  const user = await upsertUser({
    supabaseId: params.supabaseId,
    email: params.email,
    phone: params.phone,
    firstName: params.firstName,
    lastName: params.lastName,
  });

  // 3. Create membership as staff
  const membership = await createMembership({
    userId: user.id,
    companyId: company.id,
    role: "staff",
  });

  return { user, company, membership };
}

// ─── Schedule (Shifts + Events for user) ─────────────

export async function getUserShifts(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("shifts")
    .select("*, events(id, name, location, company_id)")
    .eq("assigned_user_id", userId)
    .order("start_time", { ascending: true });
  return (data ?? []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: any) => s.events?.company_id === companyId
  );
}

export async function getUpcomingEvents(companyId: string) {
  const supabase = createClient();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("company_id", companyId)
    .gte("end_date", now)
    .order("start_date", { ascending: true })
    .limit(20);
  return data ?? [];
}

// ─── Time Off (create request) ───────────────────────

export async function getTimeOffPolicies(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("time_off_policies")
    .select("*")
    .eq("company_id", companyId)
    .order("name", { ascending: true });
  return data ?? [];
}

export async function createTimeOffRequest(params: {
  policyId: string;
  startDate: string;
  endDate: string;
  note?: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("time_off_requests")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      policy_id: params.policyId,
      start_date: params.startDate,
      end_date: params.endDate,
      note: params.note ?? null,
      status: "pending",
      created_at: new Date().toISOString(),
    })
    .select("*, time_off_policies(name, type)")
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

// ─── Quiz attempts ──────────────────────────────────

export async function submitQuizAttempt(params: {
  quizId: string;
  answers: Record<string, unknown>;
  score: number;
  passed: boolean;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .insert({
      id: crypto.randomUUID(),
      quiz_id: params.quizId,
      user_id: userId,
      answers: params.answers,
      score: params.score,
      passed: params.passed,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getUserQuizAttempts(quizId?: string) {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  let query = supabase
    .from("quiz_attempts")
    .select("*, quizzes(title)")
    .eq("user_id", userId)
    .order("started_at", { ascending: false });
  if (quizId) query = query.eq("quiz_id", quizId);
  const { data } = await query.limit(20);
  return data ?? [];
}

// ─── Company stats (for Intel page) ─────────────────

export async function getCompanyStats(companyId: string) {
  const supabase = createClient();
  const [members, events, assets, forms, sheets] = await Promise.all([
    supabase.from("company_memberships").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "active"),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("assets").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("forms").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_active", true),
    supabase.from("timesheets").select("id, clock_in, clock_out").not("clock_out", "is", null).limit(500),
  ]);

  let totalHours = 0;
  for (const t of sheets.data ?? []) {
    if (t.clock_in && t.clock_out) {
      totalHours += (new Date(t.clock_out).getTime() - new Date(t.clock_in).getTime()) / 3600000;
    }
  }

  return {
    memberCount: members.count ?? 0,
    eventCount: events.count ?? 0,
    assetCount: assets.count ?? 0,
    formCount: forms.count ?? 0,
    totalHoursLogged: Math.round(totalHours * 10) / 10,
  };
}

// ─── Time-off policy CRUD (admin) ────────────────────

export async function createTimeOffPolicy(params: {
  companyId: string;
  name: string;
  type: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("time_off_policies")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      type: params.type,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Leave request approve / deny (admin) ────────────

export async function reviewTimeOffRequest(requestId: string, status: "approved" | "denied") {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("time_off_requests")
    .update({ status, reviewed_by_id: userId, reviewed_at: new Date().toISOString() })
    .eq("id", requestId)
    .select("*, time_off_policies(name, type)")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAllTimeOffRequests(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("time_off_requests")
    .select("*, time_off_policies!inner(name, type, company_id), users(first_name, last_name)")
    .eq("time_off_policies.company_id", companyId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// ─── Timesheet approval (admin) ──────────────────────

export async function getCompanyTimesheets(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("timesheets")
    .select("*, users!timesheets_user_id_fkey(first_name, last_name, company_memberships!inner(company_id))")
    .order("clock_in", { ascending: false })
    .limit(50);
  // Filter to company members
  return (data ?? []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (t: any) => t.users?.company_memberships?.some((m: any) => m.company_id === companyId)
  );
}

export async function approveTimesheet(timesheetId: string) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("timesheets")
    .update({ approved: true, approved_by_id: userId, approved_at: new Date().toISOString() })
    .eq("id", timesheetId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Shift CRUD + assignment (admin) ─────────────────

export async function getEventShifts(eventId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("shifts")
    .select("*, users(first_name, last_name)")
    .eq("event_id", eventId)
    .order("start_time", { ascending: true });
  return data ?? [];
}

export async function createShift(params: {
  eventId: string;
  role?: string;
  startTime: string;
  endTime: string;
  assignedUserId?: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shifts")
    .insert({
      id: crypto.randomUUID(),
      event_id: params.eventId,
      role: params.role ?? null,
      start_time: params.startTime,
      end_time: params.endTime,
      assigned_user_id: params.assignedUserId ?? null,
      status: params.assignedUserId ? "confirmed" : "open",
      ...ts(),
    })
    .select("*, users(first_name, last_name)")
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Asset checkout / checkin ────────────────────────

export async function checkoutAsset(assetId: string) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assets")
    .update({ status: "checked_out", current_holder_id: userId, updated_at: new Date().toISOString() })
    .eq("id", assetId)
    .select("*, users(first_name, last_name)")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function checkinAsset(assetId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assets")
    .update({ status: "available", current_holder_id: null, updated_at: new Date().toISOString() })
    .eq("id", assetId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
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
