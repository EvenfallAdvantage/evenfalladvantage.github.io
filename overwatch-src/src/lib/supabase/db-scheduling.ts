/**
 * Auto-Assign (Smart Fill) Scheduling
 *
 * Given an event with open (unassigned) shifts, picks the best-fit
 * staff member for each shift based on:
 *   - availability (event RSVPs)
 *   - weekly hours (avoid OT)
 *   - minimum rest period between shifts
 *   - role preference (lead / breaker get a small bump)
 *
 * Shifts are created elsewhere — typically via the Quick Fill panel.
 * This module does NOT create shifts; it only assigns existing ones.
 *
 * History: an earlier iteration of this file included shift template
 * recurrence + a `generateShiftsFromTemplates` function. Those wrote to
 * tables/columns that never existed in any migration (`shift_templates`,
 * `shifts.date`, `shifts.template_id`) and so were dead code from day
 * one. They were removed in favor of Quick Fill, which writes proper
 * TIMESTAMPTZ start_time / end_time rows directly.
 */

import { createClient } from "./client";

// ─── Smart Fill (Auto-Assign) ─────────────────────────────

export interface FillCandidate {
  userId: string;
  userName: string;
  score: number;        // higher = better fit
  reasons: string[];    // why they were ranked this way
  weeklyHours: number;
  isAvailable: boolean;
  lastShiftEnd: string | null;
  restHours: number | null;
}

export interface FillResult {
  shiftId: string;
  assigned: FillCandidate | null;
  candidates: FillCandidate[];
  reason: string;
}

/**
 * Smart-fill open shifts for an event.
 *
 * Considers: availability, weekly OT threshold, min rest period, role.
 * Returns a per-shift assignment result with top-5 candidates for review.
 *
 * @param eventId Event whose open shifts to fill
 * @param companyId The owning company
 * @param options Optional knobs (max weekly hours, min rest, dryRun)
 */
export async function smartFillShifts(
  eventId: string,
  companyId: string,
  options?: {
    maxWeeklyHours?: number;   // default 40
    minRestHours?: number;     // default 8
    dryRun?: boolean;          // if true, don't actually assign — just return suggestions
  },
): Promise<FillResult[]> {
  const maxHours = options?.maxWeeklyHours ?? 40;
  const minRest = options?.minRestHours ?? 8;
  const dryRun = options?.dryRun ?? false;

  const supabase = createClient();

  // Get open (unassigned) shifts.
  // shifts.start_time and shifts.end_time are TIMESTAMPTZ — full datetimes,
  // not date+time pairs. Earlier versions of this file queried a nonexistent
  // "date" column and so quietly returned 0 results from day one.
  const { data: openShifts, error: openShiftsErr } = await supabase
    .from("shifts")
    .select("id, start_time, end_time, role")
    .eq("event_id", eventId)
    .is("assigned_user_id", null)
    .order("start_time");

  if (openShiftsErr) {
    console.error("[Scheduling] Open shifts query failed:", openShiftsErr.message);
    return [];
  }
  if (!openShifts?.length) return [];

  // Get company members (exclude clients).
  const { data: members } = await supabase
    .from("company_memberships")
    .select("user_id, role, users(first_name, last_name)")
    .eq("company_id", companyId)
    .eq("status", "active")
    .not("role", "eq", "client");

  if (!members?.length) return [];

  // Get event availability RSVPs.
  const { data: availability } = await supabase
    .from("event_availability")
    .select("user_id, status")
    .eq("event_id", eventId);
  const availMap = new Map<string, string>();
  for (const a of availability ?? []) {
    availMap.set(a.user_id, a.status);
  }

  // Get this week's completed timesheets for OT calculation.
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const { data: timesheets } = await supabase
    .from("timesheets")
    .select("user_id, clock_in, clock_out")
    .eq("company_id", companyId)
    .not("clock_out", "is", null)
    .gte("clock_in", weekStart.toISOString());

  const weeklyHoursMap = new Map<string, number>();
  type TimesheetRow = { user_id: string; clock_in: string; clock_out: string };
  for (const t of (timesheets ?? []) as TimesheetRow[]) {
    const hours = (new Date(t.clock_out).getTime() - new Date(t.clock_in).getTime()) / 3600000;
    weeklyHoursMap.set(t.user_id, (weeklyHoursMap.get(t.user_id) ?? 0) + hours);
  }

  // Get existing assigned shifts (any event) for rest-period calculation.
  // We use end_time across all events the user is scheduled for, not just
  // this one, because a shift assignment elsewhere still consumes rest time.
  const { data: assignedShifts } = await supabase
    .from("shifts")
    .select("assigned_user_id, end_time")
    .not("assigned_user_id", "is", null)
    .order("end_time", { ascending: false });

  // Most recent end_time per user.
  const lastShiftEndMap = new Map<string, string>();
  type AssignedRow = { assigned_user_id: string; end_time: string };
  for (const s of (assignedShifts ?? []) as AssignedRow[]) {
    if (!lastShiftEndMap.has(s.assigned_user_id)) {
      lastShiftEndMap.set(s.assigned_user_id, s.end_time);
    }
  }

  // Score and rank candidates for each open shift.
  const results: FillResult[] = [];

  type ShiftRow = { id: string; start_time: string; end_time: string; role: string | null };
  for (const shift of openShifts as ShiftRow[]) {
    const shiftStartMs = new Date(shift.start_time).getTime();
    const shiftEndMs = new Date(shift.end_time).getTime();
    const shiftHours = Math.max(0, (shiftEndMs - shiftStartMs) / 3600000);

    type MemberRow = {
      user_id: string;
      role: string;
      users?: { first_name?: string; last_name?: string } | null;
    };
    const candidates: FillCandidate[] = (members as MemberRow[]).map((m) => {
      const userId = m.user_id;
      const userName = m.users
        ? `${m.users.first_name ?? ""} ${m.users.last_name ?? ""}`.trim() || "Unknown"
        : "Unknown";
      const reasons: string[] = [];
      let score = 50; // base score

      // Availability
      const availStatus = availMap.get(userId) ?? "unknown";
      const isAvailable = availStatus === "available" || availStatus === "unknown";
      if (availStatus === "available") { score += 20; reasons.push("Available"); }
      else if (availStatus === "tentative") { score += 5; reasons.push("Tentative"); }
      else if (availStatus === "unavailable") { score -= 100; reasons.push("Unavailable"); }

      // Weekly hours / OT
      const weeklyHrs = weeklyHoursMap.get(userId) ?? 0;
      const projectedHrs = weeklyHrs + shiftHours;
      if (projectedHrs > maxHours) {
        score -= 50;
        reasons.push(`Would exceed ${maxHours}h (${projectedHrs.toFixed(1)}h)`);
      } else if (projectedHrs > maxHours - 5) {
        score -= 10;
        reasons.push("Approaching OT");
      } else {
        score += 10;
        reasons.push(`${weeklyHrs.toFixed(1)}h this week`);
      }

      // Min rest period
      const lastEnd = lastShiftEndMap.get(userId);
      let restHours: number | null = null;
      if (lastEnd) {
        restHours = (shiftStartMs - new Date(lastEnd).getTime()) / 3600000;
        if (restHours < minRest) {
          score -= 30;
          reasons.push(`Only ${restHours.toFixed(1)}h rest (min ${minRest})`);
        } else {
          score += 5;
          reasons.push(`${restHours.toFixed(1)}h rest`);
        }
      }

      // Role preference (leads/breakers slightly preferred for coverage)
      if (m.role === "lead") score += 5;
      if (m.role === "breaker") score += 3;

      return {
        userId, userName, score, reasons,
        weeklyHours: weeklyHrs,
        isAvailable,
        lastShiftEnd: lastEnd ?? null,
        restHours,
      };
    });

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    const bestCandidate = candidates.find((c) => c.score > 0) ?? null;

    if (bestCandidate && !dryRun) {
      // Assign the shift
      await supabase
        .from("shifts")
        .update({
          assigned_user_id: bestCandidate.userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", shift.id);

      // Update weekly hours and last-shift-end for subsequent iterations
      // so a single bulk-fill doesn't pile multiple shifts onto one person
      // when others are also eligible.
      weeklyHoursMap.set(
        bestCandidate.userId,
        (weeklyHoursMap.get(bestCandidate.userId) ?? 0) + shiftHours,
      );
      lastShiftEndMap.set(bestCandidate.userId, shift.end_time);
    }

    results.push({
      shiftId: shift.id,
      assigned: bestCandidate,
      candidates: candidates.slice(0, 5),
      reason: bestCandidate
        ? `Assigned to ${bestCandidate.userName} (score: ${bestCandidate.score})`
        : "No eligible candidates found",
    });
  }

  return results;
}
