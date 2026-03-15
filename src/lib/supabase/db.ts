import { createClient } from "./client";

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
        supabase_id: data.supabaseId,
        email: data.email ?? null,
        phone: data.phone ?? null,
        first_name: data.firstName,
        last_name: data.lastName,
        avatar_url: data.avatarUrl ?? null,
      },
      { onConflict: "supabase_id" }
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
}) {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.brandColor !== undefined) payload.brand_color = updates.brandColor;
  if (updates.timezone !== undefined) payload.timezone = updates.timezone;
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
