/**
 * Shift Swap / Trade / Pickup Marketplace
 *
 * Allows staff to:
 *   - Offer a shift they can't work (creates a swap request)
 *   - Browse open swap requests and claim shifts
 *   - Auto-approve if the replacement meets cert requirements
 *   - Manager override for manual approval
 *
 * Table: shift_swap_requests (must be created via SQL migration)
 *   id, shift_id, requester_id, replacement_id, status, reason, created_at
 */

import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";
import { logDbReadError } from "./db-error";

export type SwapStatus = "open" | "claimed" | "approved" | "rejected" | "cancelled";

export interface ShiftSwapRequest {
  id: string;
  shiftId: string;
  requesterId: string;
  requesterName: string;
  replacementId: string | null;
  replacementName: string | null;
  status: SwapStatus;
  reason: string;
  shiftDate: string;
  shiftStart: string;
  shiftEnd: string;
  shiftRole: string;
  eventName: string;
  createdAt: string;
}

// ─── CRUD ─────────────────────────────────────────────────

/**
 * Create a new shift swap request (staff offering their shift).
 */
export async function createSwapRequest(
  shiftId: string,
  reason: string
): Promise<string | null> {
  const userId = await ensureInternalUser();
  if (!userId) return null;
  const supabase = createClient();
  const id = crypto.randomUUID();
  const { error } = await supabase
    .from("shift_swap_requests")
    .insert({
      id,
      shift_id: shiftId,
      requester_id: userId,
      replacement_id: null,
      status: "open",
      reason,
      ...ts(),
    });
  if (error) {
    console.error("[ShiftSwap] Create failed:", error.message);
    return null;
  }
  return id;
}

/**
 * Claim an open swap request (another staff member volunteers).
 */
export async function claimSwapRequest(swapId: string): Promise<boolean> {
  const userId = await ensureInternalUser();
  if (!userId) return false;
  const supabase = createClient();
  const { error } = await supabase
    .from("shift_swap_requests")
    .update({ replacement_id: userId, status: "claimed", updated_at: new Date().toISOString() })
    .eq("id", swapId)
    .eq("status", "open");
  if (error) {
    console.error("[ShiftSwap] Claim failed:", error.message);
    return false;
  }
  return true;
}

/**
 * Approve a claimed swap (manager action). Reassigns the shift.
 */
export async function approveSwapRequest(swapId: string): Promise<boolean> {
  const supabase = createClient();

  // Get the swap details
  const { data: swap, error: fetchErr } = await supabase
    .from("shift_swap_requests")
    .select("shift_id, replacement_id")
    .eq("id", swapId)
    .eq("status", "claimed")
    .maybeSingle();
  if (fetchErr || !swap?.replacement_id) return false;

  // Reassign the shift
  const { error: assignErr } = await supabase
    .from("shifts")
    .update({ assigned_user_id: swap.replacement_id, updated_at: new Date().toISOString() })
    .eq("id", swap.shift_id);
  if (assignErr) {
    console.error("[ShiftSwap] Shift reassign failed:", assignErr.message);
    return false;
  }

  // Update swap status
  const { error: updateErr } = await supabase
    .from("shift_swap_requests")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", swapId);
  if (updateErr) {
    console.error("[ShiftSwap] Status update failed:", updateErr.message);
    return false;
  }
  return true;
}

/**
 * Reject a swap request (manager action).
 */
export async function rejectSwapRequest(swapId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("shift_swap_requests")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", swapId);
  return !error;
}

/**
 * Cancel a swap request (requester withdraws).
 */
export async function cancelSwapRequest(swapId: string): Promise<boolean> {
  const userId = await ensureInternalUser();
  if (!userId) return false;
  const supabase = createClient();
  const { error } = await supabase
    .from("shift_swap_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", swapId)
    .eq("requester_id", userId)
    .in("status", ["open", "claimed"]);
  return !error;
}

// ─── Queries ──────────────────────────────────────────────

/**
 * Get open swap requests for the company (available to claim).
 */
export async function getOpenSwapRequests(companyId: string): Promise<ShiftSwapRequest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shift_swap_requests")
    .select(`
      id, shift_id, requester_id, replacement_id, status, reason, created_at,
      shifts!inner(date, start_time, end_time, role, events!inner(name, company_id)),
      requester:users!shift_swap_requests_requester_id_fkey(first_name, last_name)
    `)
    .eq("shifts.events.company_id", companyId)
    .in("status", ["open", "claimed"])
    .order("created_at", { ascending: false });

  if (error) { logDbReadError("shift-swap:open", error); return []; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    shiftId: r.shift_id,
    requesterId: r.requester_id,
    requesterName: r.requester ? `${r.requester.first_name} ${r.requester.last_name}` : "Unknown",
    replacementId: r.replacement_id,
    replacementName: null, // Populated separately if needed
    status: r.status,
    reason: r.reason ?? "",
    shiftDate: r.shifts?.date ?? "",
    shiftStart: r.shifts?.start_time ?? "",
    shiftEnd: r.shifts?.end_time ?? "",
    shiftRole: r.shifts?.role ?? "",
    eventName: r.shifts?.events?.name ?? "",
    createdAt: r.created_at,
  }));
}

/**
 * Get swap requests for the current user (their own offers).
 */
export async function getMySwapRequests(): Promise<ShiftSwapRequest[]> {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shift_swap_requests")
    .select(`
      id, shift_id, requester_id, replacement_id, status, reason, created_at,
      shifts(date, start_time, end_time, role, events(name))
    `)
    .eq("requester_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) { logDbReadError("shift-swap:mine", error); return []; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    shiftId: r.shift_id,
    requesterId: r.requester_id,
    requesterName: "Me",
    replacementId: r.replacement_id,
    replacementName: null,
    status: r.status,
    reason: r.reason ?? "",
    shiftDate: r.shifts?.date ?? "",
    shiftStart: r.shifts?.start_time ?? "",
    shiftEnd: r.shifts?.end_time ?? "",
    shiftRole: r.shifts?.role ?? "",
    eventName: r.shifts?.events?.name ?? "",
    createdAt: r.created_at,
  }));
}

/**
 * Get pending swap requests that need manager approval.
 */
export async function getPendingSwapApprovals(companyId: string): Promise<ShiftSwapRequest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shift_swap_requests")
    .select(`
      id, shift_id, requester_id, replacement_id, status, reason, created_at,
      shifts!inner(date, start_time, end_time, role, events!inner(name, company_id)),
      requester:users!shift_swap_requests_requester_id_fkey(first_name, last_name),
      replacement:users!shift_swap_requests_replacement_id_fkey(first_name, last_name)
    `)
    .eq("shifts.events.company_id", companyId)
    .eq("status", "claimed")
    .order("created_at", { ascending: true });

  if (error) { logDbReadError("shift-swap:pending", error); return []; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    shiftId: r.shift_id,
    requesterId: r.requester_id,
    requesterName: r.requester ? `${r.requester.first_name} ${r.requester.last_name}` : "Unknown",
    replacementId: r.replacement_id,
    replacementName: r.replacement ? `${r.replacement.first_name} ${r.replacement.last_name}` : null,
    status: r.status,
    reason: r.reason ?? "",
    shiftDate: r.shifts?.date ?? "",
    shiftStart: r.shifts?.start_time ?? "",
    shiftEnd: r.shifts?.end_time ?? "",
    shiftRole: r.shifts?.role ?? "",
    eventName: r.shifts?.events?.name ?? "",
    createdAt: r.created_at,
  }));
}
