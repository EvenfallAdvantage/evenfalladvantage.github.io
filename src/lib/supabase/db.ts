import { createClient } from "./client";

// ─── Helper: get current Supabase auth user ID ─────────
async function getAuthUserId() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
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
    .single();

  if (error) throw error;
  return user;
}

export async function fetchUserProfile() {
  const authId = await getAuthUserId();
  if (!authId) return null;

  const supabase = createClient();

  // Get user record
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("*")
    .eq("supabase_id", authId)
    .single();

  if (userErr || !user) return null;

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
      user_id: data.userId,
      company_id: data.companyId,
      role: data.role ?? "staff",
      status: "active",
      work_preferences: [],
      notification_days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    })
    .select()
    .single();

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
  const authId = await getAuthUserId();
  if (!authId) return null;

  const supabase = createClient();
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("supabase_id", authId)
    .single();
  if (!user) return null;

  const { data } = await supabase
    .from("timesheets")
    .select("*")
    .eq("user_id", user.id)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .single();

  return data;
}

export async function clockIn() {
  const authId = await getAuthUserId();
  if (!authId) throw new Error("Not authenticated");

  const supabase = createClient();
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("supabase_id", authId)
    .single();
  if (!user) throw new Error("User not found in database");

  const { data, error } = await supabase
    .from("timesheets")
    .insert({
      user_id: user.id,
      clock_in: new Date().toISOString(),
      clock_method: "app",
    })
    .select()
    .single();

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
    .single();

  if (error) throw error;
  return data;
}

export async function getRecentTimesheets(limit = 10) {
  const authId = await getAuthUserId();
  if (!authId) return [];

  const supabase = createClient();
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("supabase_id", authId)
    .single();
  if (!user) return [];

  const { data } = await supabase
    .from("timesheets")
    .select("*")
    .eq("user_id", user.id)
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
  const authId = await getAuthUserId();
  if (!authId) throw new Error("Not authenticated");

  const supabase = createClient();
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("supabase_id", authId)
    .single();
  if (!user) throw new Error("User not found");

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      company_id: data.companyId,
      user_id: user.id,
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
    .single();

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
    .single();

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
