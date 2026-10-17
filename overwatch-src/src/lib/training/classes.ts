import { activeCompanyId, db, fail, nowIso, rowsOrMissing, type WriteResult } from "./shared";
import { ensureInternalUser } from "@/lib/supabase/db-helpers";
import type { ClassAttendanceRow, ClassEnrollmentRow, LegacyScheduledClass } from "./types";

/** Today's date (YYYY-MM-DD) in the user's time zone (toISOString() is UTC). */
export function localDateString(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const LEGACY_CLASS_TYPES = [
  { value: "training", label: "General Training" },
  { value: "review", label: "Review Session" },
  { value: "scenario", label: "Scenario Training" },
  { value: "proctored_exam", label: "Proctored Exam" },
] as const;

/** UI class fields -> training_classes columns (max_students -> capacity, instructor_id -> instructor_user_id). */
export function toClassRow<T extends { max_students?: number; instructor_id?: string }>(cls: T): Record<string, unknown> {
  const { max_students, instructor_id, ...rest } = cls;
  return {
    ...rest,
    ...(max_students === undefined ? {} : { capacity: max_students }),
    ...(instructor_id === undefined ? {} : { instructor_user_id: instructor_id }),
  };
}

function toClass(r: Record<string, unknown>): LegacyScheduledClass {
  return {
    id: r.id as string, instructor_id: (r.instructor_user_id as string | null) ?? "", class_name: r.class_name as string,
    class_type: (r.class_type as string | null) ?? null, description: (r.description as string | null) ?? null,
    scheduled_date: (r.scheduled_date as string | null) ?? "", start_time: (r.start_time as string | null) ?? "",
    end_time: (r.end_time as string | null) ?? null, location: (r.location as string | null) ?? null,
    max_students: (r.capacity as number | null) ?? null, status: (r.status as string) ?? "scheduled",
    enrollments: (r.enrollments as { count: number }[] | undefined) ?? [{ count: 0 }],
  };
}

async function listClasses(opts: { instructorId?: string; upcomingOnly: boolean }): Promise<LegacyScheduledClass[]> {
  const companyId = activeCompanyId();
  if (!companyId) return [];
  let q = db().from("training_classes").select("*, enrollments:training_class_enrollments(count)")
    .eq("company_id", companyId)
    .order("scheduled_date", { ascending: opts.upcomingOnly });
  if (opts.upcomingOnly) q = q.gte("scheduled_date", localDateString());
  if (opts.instructorId) q = q.eq("instructor_user_id", opts.instructorId);
  const { data, error } = await q;
  if (error) { console.error("Training: getClasses error:", error); return []; }
  return (data ?? []).map(toClass);
}

/** Upcoming classes (today onwards), optionally one instructor's. */
export function getLegacyClasses(instructorId?: string): Promise<LegacyScheduledClass[]> {
  return listClasses({ instructorId, upcomingOnly: true });
}

/** All classes (past included), newest first. */
export function getAllLegacyClasses(instructorId?: string): Promise<LegacyScheduledClass[]> {
  return listClasses({ instructorId, upcomingOnly: false });
}

export async function createLegacyClass(classData: {
  instructor_id: string;
  class_name: string;
  class_type?: string;
  description?: string;
  scheduled_date: string;
  start_time: string;
  end_time?: string;
  location?: string;
  max_students?: number;
}): Promise<WriteResult> {
  const companyId = activeCompanyId();
  if (!companyId) return { success: false, error: "missing_company" };
  const { data, error } = await db().from("training_classes")
    .insert({ ...toClassRow({ ...classData, class_type: classData.class_type || "training" }), company_id: companyId, status: "scheduled" })
    .select("id").single();
  if (error) return fail("createClass", error);
  return { success: true, id: data.id };
}

export async function updateLegacyClass(classId: string, updates: Partial<{
  class_name: string;
  description: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  location: string;
  max_students: number;
  class_type: string;
  status: string;
}>): Promise<WriteResult> {
  const { data, error } = await db().from("training_classes").update({ ...toClassRow(updates), updated_at: nowIso() })
    .eq("id", classId).select("id");
  if (error) return fail("updateClass", error);
  return rowsOrMissing(data);
}

export async function enrollStudentInClass(classId: string, studentId: string): Promise<WriteResult> {
  const companyId = activeCompanyId();
  if (!companyId) return { success: false, error: "missing_company" };
  const { error } = await db().from("training_class_enrollments").upsert(
    { company_id: companyId, class_id: classId, user_id: studentId, enrollment_status: "enrolled" },
    { onConflict: "class_id,user_id" });
  if (error) return fail("enrollInClass", error);
  return { success: true };
}

export async function removeStudentFromClass(classId: string, studentId: string): Promise<WriteResult> {
  const { data, error } = await db().from("training_class_enrollments").delete()
    .eq("class_id", classId).eq("user_id", studentId).select("id");
  if (error) return fail("removeFromClass", error);
  return rowsOrMissing(data);
}

type RosterRow = {
  user_id: string; first_name: string | null; last_name: string | null; email: string | null;
  enrollment_status: string; attendance_status: string | null; attendance_notes: string | null; marked_at: string | null;
};

async function roster(classId: string): Promise<RosterRow[]> {
  const { data, error } = await db().rpc("training_class_roster", { p_class_id: classId });
  if (error) { console.error("Training: classRoster error:", error); return []; }
  return (data ?? []) as RosterRow[];
}

const person = (r: RosterRow) => ({ first_name: r.first_name ?? "", last_name: r.last_name ?? "", email: r.email ?? "" });

export async function getClassEnrollments(classId: string): Promise<ClassEnrollmentRow[]> {
  return (await roster(classId)).map((r) => ({ student_id: r.user_id, enrollment_status: r.enrollment_status, student: person(r) }));
}

export async function getClassAttendance(classId: string): Promise<ClassAttendanceRow[]> {
  return (await roster(classId)).filter((r) => r.attendance_status).map((r) => ({
    student_id: r.user_id, status: r.attendance_status as string, notes: r.attendance_notes,
    marked_at: r.marked_at ?? "", student: person(r),
  }));
}

export async function markAttendance(
  classId: string,
  studentId: string,
  status: "present" | "absent" | "late" | "excused",
  notes?: string,
): Promise<WriteResult> {
  const companyId = activeCompanyId();
  if (!companyId) return { success: false, error: "missing_company" };
  const markedBy = await ensureInternalUser();
  const { error } = await db().from("training_class_attendance").upsert(
    { company_id: companyId, class_id: classId, user_id: studentId, attendance_status: status,
      notes: notes || null, marked_by: markedBy ?? null },
    { onConflict: "class_id,user_id" });
  if (error) return fail("markAttendance", error);
  return { success: true };
}
