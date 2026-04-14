import { createClient } from "@/lib/supabase/client";
import { ensureInternalUser } from "./db-helpers";

export interface StaffBadge {
  id: string;
  company_id: string;
  user_id: string;
  badge_number: string | null;
  qr_data: string;
  generated_at: string;
  revoked_at: string | null;
}

/**
 * Get or create a badge for a staff member.
 * QR data format: JSON { uid, cid, bn } where bn = badge number
 */
export async function getOrCreateBadge(
  companyId: string,
  userId: string,
  badgeNumber?: string
): Promise<StaffBadge> {
  const supabase = createClient();

  // Check for existing badge
  const { data: existing } = await supabase
    .from("staff_badges")
    .select("*")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (existing) return existing as StaffBadge;

  // Generate badge number if not provided
  const bn = badgeNumber || `EA-${Date.now().toString(36).toUpperCase()}`;

  // QR data is a compact JSON string
  const qrData = JSON.stringify({ uid: userId, cid: companyId, bn });

  const generatedBy = await ensureInternalUser();
  const { data, error } = await supabase
    .from("staff_badges")
    .insert({
      company_id: companyId,
      user_id: userId,
      badge_number: bn,
      qr_data: qrData,
      generated_by: generatedBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data as StaffBadge;
}

/**
 * Get the current user's active badge for a company (read-only, does NOT create).
 * Used on the Profile page so staff can view/print their own badge.
 */
export async function getMyBadge(
  companyId: string,
  userId: string
): Promise<StaffBadge | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("staff_badges")
    .select("*")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  return (data as StaffBadge) ?? null;
}

/**
 * Get all active badges for a company.
 */
export async function getCompanyBadges(companyId: string): Promise<StaffBadge[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("staff_badges")
    .select("*")
    .eq("company_id", companyId)
    .is("revoked_at", null)
    .order("generated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as StaffBadge[];
}

/**
 * Revoke a badge (e.g., when staff member leaves).
 */
export async function revokeBadge(badgeId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("staff_badges")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", badgeId);
  if (error) throw error;
}

/**
 * Look up a badge by QR data — used by the scanner.
 * Returns the badge + user info if valid and not revoked.
 */
export async function lookupBadge(qrData: string): Promise<{
  badge: StaffBadge;
  user: { id: string; first_name: string; last_name: string; avatar_url: string | null };
} | null> {
  try {
    const parsed = JSON.parse(qrData);
    if (!parsed.uid || !parsed.cid) return null;

    const supabase = createClient();
    const { data } = await supabase
      .from("staff_badges")
      .select("*, users!inner(id, first_name, last_name, avatar_url)")
      .eq("company_id", parsed.cid)
      .eq("user_id", parsed.uid)
      .is("revoked_at", null)
      .maybeSingle();

    if (!data) return null;

    const { users, ...badge } = data as StaffBadge & { users: { id: string; first_name: string; last_name: string; avatar_url: string | null } };
    return { badge: badge as StaffBadge, user: users };
  } catch {
    return null;
  }
}

/**
 * Clock in a user via QR scan (manager-initiated).
 * Similar to regular clockIn but records clock_method as 'qr_scan'.
 */
export async function qrClockIn(
  userId: string,
  companyId: string,
  eventId?: string,
  shiftId?: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("timesheets").insert({
    user_id: userId,
    company_id: companyId,
    clock_in: new Date().toISOString(),
    clock_method: "qr_scan",
    clock_in_type: eventId ? "shift" : "admin",
    event_id: eventId ?? null,
    shift_id: shiftId ?? null,
  });
  if (error) throw error;
}

/**
 * Clock out a user via QR scan.
 */
export async function qrClockOut(userId: string, companyId: string): Promise<void> {
  const supabase = createClient();
  // Find active timesheet for this user
  const { data: active } = await supabase
    .from("timesheets")
    .select("id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!active) throw new Error("No active timesheet found");

  const { error } = await supabase
    .from("timesheets")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", active.id);

  if (error) throw error;
}

/**
 * Check if a user is currently clocked in.
 */
export async function isUserClockedIn(userId: string, companyId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("timesheets")
    .select("id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .is("clock_out", null)
    .limit(1)
    .maybeSingle();

  return !!data;
}
