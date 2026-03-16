/**
 * Account Linker — Phase 2
 * 
 * Manages the link between Overwatch users and legacy portal accounts.
 * Persists links in the Overwatch `legacy_account_links` table and
 * auto-creates legacy accounts when needed.
 */

import { createClient } from "@/lib/supabase/client";
import {
  findLegacyStudentByEmail,
  createLegacyStudentProfile,
  getLegacyClient,
} from "@/lib/legacy-bridge";

export type AccountLink = {
  id: string;
  user_id: string;
  legacy_supabase_url: string;
  legacy_user_id: string;
  legacy_role: "student" | "instructor" | "admin";
  legacy_email: string | null;
  linked_at: string;
  last_synced_at: string | null;
  sync_status: "active" | "paused" | "error";
  metadata: Record<string, unknown>;
};

const LEGACY_URL = "https://vaagvairvwmgyzsmymhs.supabase.co";

// ─── Read Links ──────────────────────────────────────

/** Get all legacy links for the current user */
export async function getAccountLinks(userId: string): Promise<AccountLink[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("legacy_account_links")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error("getAccountLinks error:", error);
    return [];
  }
  return data ?? [];
}

/** Get the student link for the current user */
export async function getStudentLink(userId: string): Promise<AccountLink | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("legacy_account_links")
    .select("*")
    .eq("user_id", userId)
    .eq("legacy_role", "student")
    .maybeSingle();

  if (error) {
    console.error("getStudentLink error:", error);
    return null;
  }
  return data;
}

/** Get the instructor link for the current user */
export async function getInstructorLink(userId: string): Promise<AccountLink | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("legacy_account_links")
    .select("*")
    .eq("user_id", userId)
    .eq("legacy_role", "instructor")
    .maybeSingle();

  if (error) return null;
  return data;
}

// ─── Auto-Link Logic ─────────────────────────────────

/**
 * Ensure the current Overwatch user is linked to a legacy student account.
 * Creates the legacy student if it doesn't exist, then persists the link.
 * Returns the legacy student ID.
 */
export async function ensureStudentLinked(user: {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}): Promise<string | null> {
  // 1. Check if already linked
  const existing = await getStudentLink(user.id);
  if (existing) {
    // Update last synced
    updateSyncTimestamp(existing.id).catch(() => {});
    return existing.legacy_user_id;
  }

  // 2. Find or create legacy student
  let legacyStudentId: string | null = null;

  const found = await findLegacyStudentByEmail(user.email);
  if (found) {
    legacyStudentId = found.id;
  } else {
    const result = await createLegacyStudentProfile(
      user.id,
      user.email,
      user.firstName || "",
      user.lastName || ""
    );
    if (result.success) {
      legacyStudentId = user.id;
    }
  }

  if (!legacyStudentId) return null;

  // 3. Persist the link in Overwatch DB
  await persistLink(user.id, legacyStudentId, "student", user.email);

  return legacyStudentId;
}

/**
 * For owners/admins: also link as instructor in legacy.
 * Finds existing instructor by email or creates one.
 */
export async function ensureInstructorLinked(user: {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}): Promise<string | null> {
  // Check if already linked
  const existing = await getInstructorLink(user.id);
  if (existing) {
    updateSyncTimestamp(existing.id).catch(() => {});
    return existing.legacy_user_id;
  }

  const legacy = getLegacyClient();

  // Find existing instructor by email
  const { data: found } = await legacy
    .from("instructors")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();

  let instructorId: string | null = null;

  if (found) {
    instructorId = found.id;
  } else {
    // Create instructor in legacy
    const { data: created, error } = await legacy
      .from("instructors")
      .insert({
        id: user.id,
        email: user.email,
        first_name: user.firstName || "",
        last_name: user.lastName || "",
        role: "instructor",
        is_active: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Create legacy instructor error:", error);
      return null;
    }
    instructorId = created.id;
  }

  if (!instructorId) return null;

  await persistLink(user.id, instructorId, "instructor", user.email);
  return instructorId;
}

/**
 * Full role-based linking. Call this when a user first accesses training features.
 * - member → student link
 * - manager/admin → student + instructor link
 * - owner → student + instructor link
 */
export async function autoLinkByRole(user: {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}): Promise<{ studentId: string | null; instructorId: string | null }> {
  const studentId = await ensureStudentLinked(user);

  let instructorId: string | null = null;
  if (user.role === "owner" || user.role === "admin" || user.role === "manager") {
    instructorId = await ensureInstructorLinked(user);
  }

  return { studentId, instructorId };
}

// ─── Persistence Helpers ─────────────────────────────

async function persistLink(
  userId: string,
  legacyUserId: string,
  role: "student" | "instructor" | "admin",
  email: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("legacy_account_links")
    .upsert(
      {
        user_id: userId,
        legacy_supabase_url: LEGACY_URL,
        legacy_user_id: legacyUserId,
        legacy_role: role,
        legacy_email: email,
        linked_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        sync_status: "active",
      },
      { onConflict: "user_id,legacy_role" }
    );

  if (error) {
    console.error(`persistLink (${role}) error:`, error);
  }
}

async function updateSyncTimestamp(linkId: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("legacy_account_links")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", linkId);
}

/** Log a sync operation */
export async function logSync(
  userId: string,
  syncType: "progress" | "enrollment" | "certificate" | "assessment" | "full",
  direction: "legacy_to_overwatch" | "overwatch_to_legacy" | "bidirectional",
  recordsSynced: number,
  status: "success" | "partial" | "failed" = "success",
  errorMessage?: string
): Promise<void> {
  const supabase = createClient();
  await supabase.from("legacy_sync_log").insert({
    user_id: userId,
    sync_type: syncType,
    sync_direction: direction,
    records_synced: recordsSynced,
    status,
    error_message: errorMessage,
  });
}
