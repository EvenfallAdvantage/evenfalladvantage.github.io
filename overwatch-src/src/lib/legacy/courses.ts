import { getLegacyClient } from "./client";
import { viaLegacyBridge } from "./bridge";
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
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const viaBridge = await viaLegacyBridge("course.create", { values: courseData });
  if (viaBridge) return viaBridge;
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
}>): Promise<{ success: boolean; error?: string }> {
  const viaBridge = await viaLegacyBridge("course.update", { keys: { id: courseId }, values: updates });
  if (viaBridge) return viaBridge;
  const client = getLegacyClient();
  const { error } = await client.from("courses").update(updates).eq("id", courseId);
  if (error) { console.error("Legacy: updateCourse error:", error); return { success: false }; }
  return { success: true };
}

/**
 * Delete a course. Server-only (EADB has no anon/instructor DELETE policy on
 * courses). The bridge refuses with `course_in_use` while students, payments or
 * reviews reference it, because those rows would cascade away.
 */
export async function deleteLegacyCourse(courseId: string): Promise<{ success: boolean; error?: string }> {
  const viaBridge = await viaLegacyBridge("course.delete", { keys: { id: courseId } });
  return viaBridge ?? { success: false, error: "bridge_required" };
}
