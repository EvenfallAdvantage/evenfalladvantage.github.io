import { createClient } from "./client";

// Helper: generate timestamps for INSERTs (DB defaults don't fire via PostgREST)
export function ts() {
  const now = new Date().toISOString();
  return { created_at: now, updated_at: now };
}

// ─── Helper: get current Supabase auth user ID ─────────
export async function getAuthUserId() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Module-level cache: avoids repeated getUser() + DB lookup per page session.
// Seed this from AuthProvider after login so ensureInternalUser() is instant.
let _cachedInternalId: string | null = null;

/** Pre-seed the internal user ID cache (call from AuthProvider after login). */
export function seedInternalUserId(id: string) {
  _cachedInternalId = id;
}

/** Clear cache on logout. */
export function clearInternalUserCache() {
  _cachedInternalId = null;
}

// Helper: get or create internal user ID from auth user (cached)
export async function ensureInternalUser() {
  if (_cachedInternalId) return _cachedInternalId;

  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  // Try to find existing user
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("supabase_id", authUser.id)
    .maybeSingle();

  if (existing) {
    _cachedInternalId = existing.id;
    return existing.id;
  }

  // Auto-create user record from auth metadata
  const meta = authUser.user_metadata || {};
  const newId = crypto.randomUUID();
  const { data: created, error } = await supabase
    .from("users")
    .insert({
      id: newId,
      supabase_id: authUser.id,
      email: authUser.email ?? null,
      phone: authUser.phone || meta.phone || null,
      first_name: meta.first_name ?? "",
      last_name: meta.last_name ?? "",
      ...ts(),
    })
    .select("id")
    .single();

  if (error) {
    // 409 / 23505 = unique constraint conflict — another caller already created it
    const { data: retry } = await supabase
      .from("users")
      .select("id")
      .eq("supabase_id", authUser.id)
      .maybeSingle();
    if (retry) {
      _cachedInternalId = retry.id;
      return retry.id;
    }
    console.warn("Auto-create user failed:", error.message);
    return null;
  }
  _cachedInternalId = created.id;
  return created.id;
}
