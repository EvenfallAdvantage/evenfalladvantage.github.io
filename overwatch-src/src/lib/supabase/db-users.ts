import { createClient } from "./client";
import { ts, getAuthUserId, ensureInternalUser } from "./db-helpers";
import type { UserProfilePayload, CompanyPayload } from "@/types";

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

  // Try to find existing user first (don't overwrite primary key)
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("supabase_id", data.supabaseId)
    .maybeSingle();

  if (existing) {
    // Update mutable fields only — never touch id or supabase_id
    // Only overwrite names if new values are non-empty
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (data.email) updates.email = data.email;
    if (data.phone) updates.phone = data.phone;
    if (data.firstName?.trim()) updates.first_name = data.firstName;
    if (data.lastName?.trim()) updates.last_name = data.lastName;
    if (data.avatarUrl) updates.avatar_url = data.avatarUrl;

    try {
      const { data: updated, error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return updated ?? existing;
    } catch {
      // 409 conflict (unique constraint) — return existing user as-is
      return existing;
    }
  }

  // No existing user — create new
  const { data: created, error } = await supabase
    .from("users")
    .insert({
      id: crypto.randomUUID(),
      supabase_id: data.supabaseId,
      email: data.email ?? null,
      phone: data.phone ?? null,
      first_name: data.firstName,
      last_name: data.lastName,
      avatar_url: data.avatarUrl ?? null,
      ...ts(),
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return created;
}

export async function fetchUserProfile(knownAuthId?: string) {
  const authId = knownAuthId ?? await getAuthUserId();
  if (!authId) return null;

  const supabase = createClient();

  // Get user record (or auto-create if missing)
  let { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("supabase_id", authId)
    .maybeSingle();

  if (!user) {
    // Auto-create from auth metadata — only call getUser() if we must
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;
    const meta = authUser.user_metadata || {};
    const newId = crypto.randomUUID();
    const { data: created, error: insertErr } = await supabase
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

    if (insertErr) {
      // 409 / 23505 = unique constraint conflict — another caller already created it
      const { data: retry } = await supabase
        .from("users")
        .select("*")
        .eq("supabase_id", authId)
        .maybeSingle();
      if (!retry) return null;
      user = retry;
    } else {
      if (!created) return null;
      user = created;
    }
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
        join_code,
        settings
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

  if (error) {
    // Slug already exists — find and return the existing company
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("companies")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (existing) return existing;
    }
    throw error;
  }
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

  if (error) {
    // Duplicate (user_id, company_id) — find and return existing
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("company_memberships")
        .select("*")
        .eq("user_id", data.userId)
        .eq("company_id", data.companyId)
        .maybeSingle();
      if (existing) return existing;
    }
    throw error;
  }
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

// ─── Roster (Directory) ─────────────────────────────────

export async function getCompanyMembers(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("company_memberships")
    .select(
      `
      id, role, nickname, status, title, hide_contact_roster,
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

// ─── Avatar upload ───────────────────────────────────────

export async function uploadAvatar(file: File): Promise<string> {
  const authId = await getAuthUserId();
  if (!authId) throw new Error("Not authenticated");

  // Validate file
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!ALLOWED.includes(file.type)) throw new Error("Only JPEG, PNG, WebP, and GIF images are allowed");
  if (file.size > MAX_SIZE) throw new Error("Image must be under 5MB");

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${authId}/avatar-${Date.now()}.${ext}`;

  const supabase = createClient();

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { cacheControl: "3600", upsert: true });
  if (uploadError) throw uploadError;

  // Get public URL
  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = urlData.publicUrl;

  // Update user record
  await updateUserProfile({ avatarUrl });

  return avatarUrl;
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
  const payload: UserProfilePayload = {};
  if (updates.firstName !== undefined) payload.first_name = updates.firstName;
  if (updates.lastName !== undefined) payload.last_name = updates.lastName;
  if (updates.phone !== undefined) payload.phone = updates.phone?.trim() || null;
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
  const payload: CompanyPayload = {};
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

export async function updateCompanySettings(companyId: string, settings: Record<string, unknown>) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("companies")
    .update({ settings })
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
  const supabase = createClient();

  // Use RPC function (SECURITY DEFINER) to bypass RLS
  const { data, error } = await supabase.rpc("join_company_by_code", {
    p_join_code: params.joinCode,
    p_supabase_id: params.supabaseId,
    p_email: params.email ?? null,
    p_phone: params.phone ?? null,
    p_first_name: params.firstName ?? "",
    p_last_name: params.lastName ?? "",
  });

  if (error) {
    // Map Postgres exception to user-friendly message
    if (error.message?.includes("Invalid company code")) {
      throw new Error("Invalid company code");
    }
    throw new Error(error.message || "Failed to join company");
  }

  if (!data) throw new Error("Failed to join company");

  return {
    user: data.user,
    company: data.company,
    membership: data.membership,
  };
}

// ─── Member management (admin) ──────────────────────

export async function updateMemberRole(membershipId: string, role: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("update_member_role", {
    p_membership_id: membershipId,
    p_new_role: role,
  });
  if (error) {
    throw new Error(error.message || "Failed to update role");
  }
  return data;
}

export async function removeMember(membershipId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("remove_company_member", {
    p_membership_id: membershipId,
  });
  if (error) {
    throw new Error(error.message || "Failed to remove member");
  }
}
