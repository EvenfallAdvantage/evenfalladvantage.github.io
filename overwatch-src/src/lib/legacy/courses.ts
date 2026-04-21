import { getLegacyClient } from "./client";
import type { LegacyCourse, LegacyCourseModule, LegacyEnrollment } from "./types";

/** Get courses from legacy. Pass includeInactive=true for instructor/admin views. */
export async function getLegacyCourses(includeInactive = false): Promise<LegacyCourse[]> {
  const client = getLegacyClient();
  let query = client.from("courses").select("*");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query.order("display_order", { ascending: true });
  if (error) {
    console.error("Legacy: getCourses error:", error);
    return [];
  }
  return data ?? [];
}

/** Get course modules (with training_module details) for a course */
export async function getLegacyCourseModules(courseId: string): Promise<LegacyCourseModule[]> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("course_modules")
    .select(`
      *,
      training_modules!course_modules_module_id_fkey (*)
    `)
    .eq("course_id", courseId)
    .order("module_order", { ascending: true });

  if (error) {
    console.error("Legacy: getCourseModules error:", error);
    return [];
  }
  return data ?? [];
}

/** Get course enrollments for a student */
export async function getLegacyEnrollments(studentId: string): Promise<LegacyEnrollment[]> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("student_course_enrollments")
    .select(`
      *,
      courses (*)
    `)
    .eq("student_id", studentId)
    .in("enrollment_status", ["active", "completed"]);

  if (error) {
    console.error("Legacy: getEnrollments error:", error);
    return [];
  }
  return data ?? [];
}

/** Enroll student in a free course in legacy DB */
export async function enrollLegacyCourse(
  studentId: string,
  courseId: string,
  enrollmentType: "free" | "paid" = "free",
  amountPaid: number = 0
): Promise<{ success: boolean }> {
  const client = getLegacyClient();

  const { error } = await client
    .from("student_course_enrollments")
    .upsert({
      student_id: studentId,
      course_id: courseId,
      enrollment_status: "active",
      enrollment_type: enrollmentType,
      amount_paid: amountPaid,
      currency: "USD",
    }, { onConflict: "student_id,course_id" });

  if (error) {
    console.error("Legacy: enrollCourse error:", error);
    return { success: false };
  }
  return { success: true };
}

/** Create a course in legacy */
export async function createLegacyCourse(courseData: {
  course_code: string;
  course_name: string;
  description?: string;
  short_description?: string;
  price?: number;
  duration_hours?: number;
  difficulty_level?: string;
  target_audience?: string;
  learning_objectives?: string[];
}): Promise<{ success: boolean; id?: string }> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("courses")
    .insert({ ...courseData, is_active: true, is_featured: false, display_order: 999 })
    .select("id")
    .single();
  if (error) { console.error("Legacy: createCourse error:", error); return { success: false }; }
  return { success: true, id: data.id };
}

/** Update a course in legacy */
export async function updateLegacyCourse(courseId: string, updates: Partial<{
  course_code: string;
  course_name: string;
  description: string;
  short_description: string;
  price: number;
  duration_hours: number;
  difficulty_level: string;
  target_audience: string;
  learning_objectives: string[];
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
}>): Promise<{ success: boolean }> {
  const client = getLegacyClient();
  const { error } = await client.from("courses").update(updates).eq("id", courseId);
  if (error) { console.error("Legacy: updateCourse error:", error); return { success: false }; }
  return { success: true };
}
