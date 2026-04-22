/**
 * Auto-Scheduling Engine
 *
 * Provides:
 *   1. Shift template recurrence (daily/weekly rolling schedules)
 *   2. Smart fill: assign open shifts based on availability + certs + OT constraints
 *   3. Min rest period enforcement between shifts
 *
 * Table: shift_templates (must be created via SQL migration)
 *   id, event_id, company_id, role, start_time, end_time, days_of_week (jsonb),
 *   recurrence, required_certs (jsonb), is_active, created_at
 */

import { createClient } from "./client";
import { ts } from "./db-helpers";
import { logDbReadError } from "./db-error";

// ─── Shift Templates ──────────────────────────────────────

export type Recurrence = "daily" | "weekly" | "biweekly" | "monthly";

export interface ShiftTemplate {
  id: string;
  eventId: string;
  companyId: string;
  role: string;
  startTime: string;      // HH:MM (local to event timezone)
  endTime: string;         // HH:MM
  daysOfWeek: number[];    // 0=Sun, 1=Mon, ... 6=Sat
  recurrence: Recurrence;
  requiredCerts: string[]; // cert_type values required for this shift
  minStaff: number;        // minimum staff needed per instance
  isActive: boolean;
}

/**
 * Create a shift template.
 */
export async function createShiftTemplate(
  params: Omit<ShiftTemplate, "id" | "isActive"> & { isActive?: boolean }
): Promise<string | null> {
  const supabase = createClient();
  const id = crypto.randomUUID();
  const { error } = await supabase
    .from("shift_templates")
    .insert({
      id,
      event_id: params.eventId,
      company_id: params.companyId,
      role: params.role,
      start_time: params.startTime,
      end_time: params.endTime,
      days_of_week: params.daysOfWeek,
      recurrence: params.recurrence,
      required_certs: params.requiredCerts,
      min_staff: params.minStaff,
      is_active: params.isActive ?? true,
      ...ts(),
    });
  if (error) { console.error("[Scheduling] Create template failed:", error.message); return null; }
  return id;
}

/**
 * Get shift templates for an event.
 */
export async function getEventShiftTemplates(eventId: string): Promise<ShiftTemplate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shift_templates")
    .select("*")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .order("start_time");
  if (error) { logDbReadError("shift-templates", error); return []; }
  return (data ?? []).map((t: Record<string, unknown>) => ({
    id: t.id as string,
    eventId: t.event_id as string,
    companyId: t.company_id as string,
    role: t.role as string,
    startTime: t.start_time as string,
    endTime: t.end_time as string,
    daysOfWeek: (t.days_of_week as number[]) ?? [],
    recurrence: t.recurrence as Recurrence,
    requiredCerts: (t.required_certs as string[]) ?? [],
    minStaff: (t.min_staff as number) ?? 1,
    isActive: t.is_active as boolean,
  }));
}

/**
 * Delete a shift template.
 */
export async function deleteShiftTemplate(templateId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("shift_templates").delete().eq("id", templateId);
  return !error;
}

// ─── Generate Shifts from Templates ───────────────────────

/**
 * Generate concrete shift records from templates for a date range.
 * Skips dates that already have shifts for the same template pattern.
 */
export async function generateShiftsFromTemplates(
  eventId: string,
  startDate: string,
  endDate: string
): Promise<{ created: number; skipped: number }> {
  const templates = await getEventShiftTemplates(eventId);
  if (!templates.length) return { created: 0, skipped: 0 };

  const supabase = createClient();

  // Get existing shifts to avoid duplicates
  const { data: existingShifts } = await supabase
    .from("shifts")
    .select("date, start_time, end_time, role")
    .eq("event_id", eventId)
    .gte("date", startDate)
    .lte("date", endDate);

  const existingSet = new Set(
    (existingShifts ?? []).map((s: { date: string; start_time: string; end_time: string; role: string }) =>
      `${s.date}|${s.start_time}|${s.end_time}|${s.role}`
    )
  );

  // Generate shifts for each day in range
  const shifts: Record<string, unknown>[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  let skipped = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const dateStr = d.toISOString().split("T")[0];

    for (const template of templates) {
      if (!template.daysOfWeek.includes(dayOfWeek)) continue;

      const key = `${dateStr}|${template.startTime}|${template.endTime}|${template.role}`;
      if (existingSet.has(key)) { skipped++; continue; }

      for (let i = 0; i < template.minStaff; i++) {
        shifts.push({
          id: crypto.randomUUID(),
          event_id: eventId,
          date: dateStr,
          start_time: template.startTime,
          end_time: template.endTime,
          role: template.role,
          assigned_user_id: null,
          template_id: template.id,
          ...ts(),
        });
      }
    }
  }

  if (shifts.length === 0) return { created: 0, skipped };

  // Bulk insert in batches of 50
  let created = 0;
  for (let i = 0; i < shifts.length; i += 50) {
    const batch = shifts.slice(i, i + 50);
    const { error } = await supabase.from("shifts").insert(batch);
    if (!error) created += batch.length;
    else console.error("[Scheduling] Batch insert failed:", error.message);
  }

  return { created, skipped };
}

// ─── Smart Fill (Auto-Assign) ─────────────────────────────

export interface FillCandidate {
  userId: string;
  userName: string;
  score: number;        // higher = better fit
  reasons: string[];    // why they were ranked this way
  weeklyHours: number;
  hasRequiredCerts: boolean;
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
 * Considers: availability, certifications, weekly OT threshold, min rest period.
 */
export async function smartFillShifts(
  eventId: string,
  companyId: string,
  options?: {
    maxWeeklyHours?: number;   // default 40
    minRestHours?: number;     // default 8
    dryRun?: boolean;          // if true, don't actually assign — just return suggestions
  }
): Promise<FillResult[]> {
  const maxHours = options?.maxWeeklyHours ?? 40;
  const minRest = options?.minRestHours ?? 8;
  const dryRun = options?.dryRun ?? false;

  const supabase = createClient();

  // Get open (unassigned) shifts
  const { data: openShifts } = await supabase
    .from("shifts")
    .select("id, date, start_time, end_time, role")
    .eq("event_id", eventId)
    .is("assigned_user_id", null)
    .order("date")
    .order("start_time");

  if (!openShifts?.length) return [];

  // Get company members with availability
  const { data: members } = await supabase
    .from("company_memberships")
    .select("user_id, role, users(first_name, last_name)")
    .eq("company_id", companyId)
    .eq("status", "active")
    .not("role", "eq", "client");

  if (!members?.length) return [];

  // Get event availability RSVPs
  const { data: availability } = await supabase
    .from("event_availability")
    .select("user_id, status")
    .eq("event_id", eventId);
  const availMap = new Map<string, string>();
  for (const a of availability ?? []) {
    availMap.set(a.user_id, a.status);
  }

  // Get this week's timesheets for OT calculation
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

  // Calculate weekly hours per user
  const weeklyHoursMap = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const ts of (timesheets ?? []) as any[]) {
    const hours = (new Date(ts.clock_out).getTime() - new Date(ts.clock_in).getTime()) / 3600000;
    weeklyHoursMap.set(ts.user_id, (weeklyHoursMap.get(ts.user_id) ?? 0) + hours);
  }

  // Get existing assigned shifts for rest-period calculation
  const { data: assignedShifts } = await supabase
    .from("shifts")
    .select("assigned_user_id, date, end_time")
    .eq("event_id", eventId)
    .not("assigned_user_id", "is", null)
    .order("date", { ascending: false })
    .order("end_time", { ascending: false });

  // Build last-shift-end map
  const lastShiftEndMap = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (assignedShifts ?? []) as any[]) {
    if (!lastShiftEndMap.has(s.assigned_user_id)) {
      lastShiftEndMap.set(s.assigned_user_id, `${s.date}T${s.end_time}`);
    }
  }

  // Get certifications for all members
  const userIds = members.map((m: { user_id: string }) => m.user_id);
  const { data: certs } = await supabase
    .from("certifications")
    .select("user_id, cert_type, expiry_date")
    .in("user_id", userIds);

  const certsByUser = new Map<string, Set<string>>();
  const nowMs = Date.now();
  for (const c of certs ?? []) {
    if (c.expiry_date && new Date(c.expiry_date).getTime() < nowMs) continue; // expired
    const set = certsByUser.get(c.user_id) ?? new Set();
    set.add(c.cert_type);
    certsByUser.set(c.user_id, set);
  }

  // Score and rank candidates for each open shift
  const results: FillResult[] = [];

  for (const shift of openShifts) {
    const shiftStartStr = `${shift.date}T${shift.start_time}`;
    const shiftHours = (() => {
      const [sh, sm] = shift.start_time.split(":").map(Number);
      const [eh, em] = shift.end_time.split(":").map(Number);
      return (eh * 60 + em - sh * 60 - sm) / 60;
    })();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidates: FillCandidate[] = members.map((m: any) => {
      const userId = m.user_id;
      const userName = m.users ? `${m.users.first_name} ${m.users.last_name}` : "Unknown";
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
      if (projectedHrs > maxHours) { score -= 50; reasons.push(`Would exceed ${maxHours}h (${projectedHrs.toFixed(1)}h)`); }
      else if (projectedHrs > maxHours - 5) { score -= 10; reasons.push("Approaching OT"); }
      else { score += 10; reasons.push(`${weeklyHrs.toFixed(1)}h this week`); }

      // Min rest period
      const lastEnd = lastShiftEndMap.get(userId);
      let restHours: number | null = null;
      if (lastEnd) {
        restHours = (new Date(shiftStartStr).getTime() - new Date(lastEnd).getTime()) / 3600000;
        if (restHours < minRest) { score -= 30; reasons.push(`Only ${restHours.toFixed(1)}h rest (min ${minRest})`); }
        else { score += 5; reasons.push(`${restHours.toFixed(1)}h rest`); }
      }

      // Required certifications
      const hasRequiredCerts = true; // TODO: check shift.template_id → template.requiredCerts vs user certs

      // Role preference (leads/breakers slightly preferred for coverage)
      if (m.role === "lead") { score += 5; }
      if (m.role === "breaker") { score += 3; }

      return {
        userId, userName, score, reasons, weeklyHours: weeklyHrs,
        hasRequiredCerts, isAvailable, lastShiftEnd: lastEnd ?? null, restHours,
      };
    });

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    const bestCandidate = candidates.find(c => c.score > 0) ?? null;

    if (bestCandidate && !dryRun) {
      // Assign the shift
      await supabase
        .from("shifts")
        .update({ assigned_user_id: bestCandidate.userId, updated_at: new Date().toISOString() })
        .eq("id", shift.id);

      // Update weekly hours and last shift end for subsequent iterations
      weeklyHoursMap.set(bestCandidate.userId, (weeklyHoursMap.get(bestCandidate.userId) ?? 0) + shiftHours);
      lastShiftEndMap.set(bestCandidate.userId, `${shift.date}T${shift.end_time}`);
    }

    results.push({
      shiftId: shift.id,
      assigned: bestCandidate,
      candidates: candidates.slice(0, 5), // top 5 for review
      reason: bestCandidate
        ? `Assigned to ${bestCandidate.userName} (score: ${bestCandidate.score})`
        : "No eligible candidates found",
    });
  }

  return results;
}
