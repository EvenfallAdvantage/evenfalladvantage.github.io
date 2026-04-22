import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";
import { logDbReadError } from "./db-error";

// ─── Schedule (Shifts + Events for user) ─────────────

export async function getUserShifts(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shifts")
    .select("*, events!inner(id, name, location, company_id, ops_guide, timezone, post_orders), post_orders")
    .eq("assigned_user_id", userId)
    .eq("events.company_id", companyId)
    .order("start_time", { ascending: true });
  if (error) { logDbReadError("shifts", error); return []; }
  return data ?? [];
}

// ─── Shift CRUD + assignment (admin) ─────────────────

export async function getEventShifts(eventId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shifts")
    .select("*, users(first_name, last_name)")
    .eq("event_id", eventId)
    .order("start_time", { ascending: true });
  if (error) { logDbReadError("event shifts", error); return []; }
  return data ?? [];
}

export async function createShift(params: {
  eventId: string;
  role?: string;
  startTime: string;
  endTime: string;
  assignedUserId?: string;
  postOrders?: string;
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
      post_orders: params.postOrders ?? null,
      ...ts(),
    })
    .select("*, users(first_name, last_name)")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function assignShift(shiftId: string, userId: string | null) {
  const supabase = createClient();
  const { error } = await supabase
    .from("shifts")
    .update({ assigned_user_id: userId, status: userId ? "confirmed" : "open" })
    .eq("id", shiftId);
  if (error) throw error;
}

/**
 * Check if a user has other shifts that overlap with the given time range.
 * Returns the list of conflicting shifts (excluding excludeShiftId if provided).
 * Overlap: shift.start_time < rangeEnd AND shift.end_time > rangeStart
 */
export async function getConflictingShifts(
  userId: string,
  startTime: string,
  endTime: string,
  excludeShiftId?: string,
) {
  const supabase = createClient();
  let q = supabase
    .from("shifts")
    .select("*, events(id, name)")
    .eq("assigned_user_id", userId)
    .lt("start_time", endTime)
    .gt("end_time", startTime);
  if (excludeShiftId) q = q.neq("id", excludeShiftId);
  const { data, error } = await q;
  if (error) { logDbReadError("conflicting shifts", error); return []; }
  return data ?? [];
}

export async function deleteShift(shiftId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("shifts").delete().eq("id", shiftId);
  if (error) throw error;
}

// ─── Bulk Shift Creation ─────────────────────────────

export async function bulkCreateShifts(
  eventId: string,
  companyId: string,
  shifts: {
    start_time: string; // UTC ISO
    end_time: string;   // UTC ISO
    role?: string;
    assigned_user_id?: string | null;
    notes?: string;
  }[],
): Promise<{ created: number; errors: string[] }> {
  const supabase = createClient();
  const errors: string[] = [];
  let created = 0;

  for (let i = 0; i < shifts.length; i += 25) {
    const batch = shifts.slice(i, i + 25).map((s) => ({
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      event_id: eventId,
      company_id: companyId,
      start_time: s.start_time,
      end_time: s.end_time,
      role: s.role ?? "Guard",
      status: s.assigned_user_id ? "confirmed" : "open",
      assigned_user_id: s.assigned_user_id ?? null,
      ...ts(),
    }));
    const { error } = await supabase.from("shifts").insert(batch);
    if (error) errors.push(`Batch ${Math.floor(i / 25) + 1}: ${error.message}`);
    else created += batch.length;
  }

  return { created, errors };
}
