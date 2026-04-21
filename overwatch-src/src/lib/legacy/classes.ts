import { getLegacyClient } from "./client";
import type { LegacyScheduledClass, ClassEnrollmentRow, ClassAttendanceRow } from "./types";

/** Get scheduled classes (upcoming) */
export async function getLegacyClasses(instructorId?: string): Promise<LegacyScheduledClass[]> {
  const client = getLegacyClient();
  let query = client
    .from("scheduled_classes")
    .select(`
      *,
      instructor:instructors(first_name, last_name, email),
      enrollments:class_enrollments(count)
    `)
    .gte("scheduled_date", new Date().toISOString().split("T")[0])
    .order("scheduled_date", { ascending: true });

  if (instructorId) {
    query = query.eq("instructor_id", instructorId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Legacy: getClasses error:", error);
    return [];
  }
  return data ?? [];
}

/** Create a scheduled class in legacy */
export async function createLegacyClass(classData: {
  instructor_id: string;
  class_name: string;
  description?: string;
  scheduled_date: string;
  start_time: string;
  end_time?: string;
  location?: string;
  max_students?: number;
}): Promise<{ success: boolean; id?: string }> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("scheduled_classes")
    .insert({ ...classData, status: "scheduled" })
    .select("id")
    .single();

  if (error) {
    console.error("Legacy: createClass error:", error);
    return { success: false };
  }
  return { success: true, id: data.id };
}

/** Update a scheduled class */
export async function updateLegacyClass(
  classId: string,
  updates: Partial<{
    class_name: string;
    description: string;
    scheduled_date: string;
    start_time: string;
    end_time: string;
    location: string;
    max_students: number;
    status: string;
  }>
): Promise<{ success: boolean }> {
  const client = getLegacyClient();
  const { error } = await client
    .from("scheduled_classes")
    .update(updates)
    .eq("id", classId);

  if (error) {
    console.error("Legacy: updateClass error:", error);
    return { success: false };
  }
  return { success: true };
}

/** Enroll a student in a class */
export async function enrollStudentInClass(
  classId: string,
  studentId: string
): Promise<{ success: boolean }> {
  const client = getLegacyClient();
  const { error } = await client
    .from("class_enrollments")
    .upsert(
      { class_id: classId, student_id: studentId, enrollment_status: "enrolled" },
      { onConflict: "class_id,student_id" }
    );

  if (error) {
    console.error("Legacy: enrollInClass error:", error);
    return { success: false };
  }
  return { success: true };
}

/** Remove a student from a class */
export async function removeStudentFromClass(
  classId: string,
  studentId: string
): Promise<{ success: boolean }> {
  const client = getLegacyClient();
  const { error } = await client
    .from("class_enrollments")
    .delete()
    .eq("class_id", classId)
    .eq("student_id", studentId);

  if (error) {
    console.error("Legacy: removeFromClass error:", error);
    return { success: false };
  }
  return { success: true };
}

/** Get students enrolled in a class */
export async function getClassEnrollments(classId: string): Promise<ClassEnrollmentRow[]> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("class_enrollments")
    .select(`
      student_id,
      enrollment_status,
      student:students(first_name, last_name, email)
    `)
    .eq("class_id", classId);

  if (error) {
    console.error("Legacy: getClassEnrollments error:", error);
    return [];
  }
  // Supabase may return student as array for non-FK; normalize
  return (data ?? []).map((row: Record<string, unknown>) => ({
    student_id: row.student_id as string,
    enrollment_status: row.enrollment_status as string,
    student: Array.isArray(row.student) ? (row.student[0] as ClassEnrollmentRow["student"]) : (row.student as ClassEnrollmentRow["student"]),
  }));
}

/** Mark attendance for a student in a class */
export async function markAttendance(
  classId: string,
  studentId: string,
  status: "present" | "absent" | "late" | "excused",
  notes?: string
): Promise<{ success: boolean }> {
  const client = getLegacyClient();
  const { error } = await client
    .from("class_attendance")
    .upsert(
      {
        class_id: classId,
        student_id: studentId,
        status,
        notes: notes || null,
        marked_at: new Date().toISOString(),
      },
      { onConflict: "class_id,student_id" }
    );

  if (error) {
    console.error("Legacy: markAttendance error:", error);
    return { success: false };
  }
  return { success: true };
}

/** Get attendance for a class */
export async function getClassAttendance(classId: string): Promise<ClassAttendanceRow[]> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("class_attendance")
    .select(`
      student_id,
      status,
      notes,
      marked_at,
      student:students(first_name, last_name, email)
    `)
    .eq("class_id", classId);

  if (error) {
    console.error("Legacy: getClassAttendance error:", error);
    return [];
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    student_id: row.student_id as string,
    status: row.status as string,
    notes: row.notes as string | null,
    marked_at: row.marked_at as string,
    student: Array.isArray(row.student) ? (row.student[0] as ClassAttendanceRow["student"]) : (row.student as ClassAttendanceRow["student"]),
  }));
}

/** Get all classes (past included) for an instructor */
export async function getAllLegacyClasses(instructorId: string): Promise<LegacyScheduledClass[]> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("scheduled_classes")
    .select(`
      *,
      instructor:instructors(first_name, last_name, email),
      enrollments:class_enrollments(count)
    `)
    .eq("instructor_id", instructorId)
    .order("scheduled_date", { ascending: false });

  if (error) {
    console.error("Legacy: getAllClasses error:", error);
    return [];
  }
  return data ?? [];
}
