import { activeCompanyId, db, fail, nowIso, rowsOrMissing, type WriteResult } from "./shared";
import { ensureInternalUser } from "@/lib/supabase/db-helpers";
import type { LegacyCourse, LegacyCourseModule, LegacyEnrollment, LegacyModule } from "./types";

type CourseRow = Record<string, unknown> & { id: string; title: string };

export function toCourse(r: CourseRow): LegacyCourse {
  return {
    id: r.id,
    course_code: (r.course_code as string | null) ?? "",
    course_name: (r.course_name as string | null) ?? r.title,
    description: (r.description as string | null) ?? null,
    short_description: (r.short_description as string | null) ?? null,
    price: Number(r.price ?? 0),
    duration_hours: r.duration_hours == null ? null : Number(r.duration_hours),
    difficulty_level: (r.difficulty_level as string | null) ?? null,
    icon: (r.icon as string | null) ?? null,
    thumbnail_url: (r.thumbnail_url as string | null) ?? null,
    is_active: r.is_active !== false,
    is_featured: r.is_featured === true,
    display_order: Number(r.display_order ?? 0),
    learning_objectives: (r.learning_objectives as string[] | null) ?? null,
    target_audience: (r.target_audience as string | null) ?? null,
    created_at: String(r.created_at ?? ""),
  };
}

/** Courses of the active company (catalog / Instructor HQ). */
export async function getLegacyCourses(includeInactive = false): Promise<LegacyCourse[]> {
  const companyId = activeCompanyId();
  if (!companyId) return [];
  let q = db().from("courses").select("*").eq("company_id", companyId)
    .order("display_order", { ascending: true }).order("title", { ascending: true });
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) { console.error("Training: getCourses error:", error); return []; }
  return ((data ?? []) as CourseRow[]).map(toCourse);
}

export async function getLegacyCourseModules(courseId: string): Promise<LegacyCourseModule[]> {
  const { data, error } = await db().from("course_modules")
    .select("id, course_id, module_id, module_order, is_required, training_modules!course_modules_module_id_fkey(*)")
    .eq("course_id", courseId).order("module_order", { ascending: true });
  if (error) { console.error("Training: getCourseModules error:", error); return []; }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string, course_id: r.course_id as string, module_id: r.module_id as string,
    module_order: Number(r.module_order ?? 0), is_required: r.is_required !== false,
    training_modules: (Array.isArray(r.training_modules) ? r.training_modules[0] : r.training_modules) as LegacyModule | undefined,
  }));
}

/** The signed-in user's enrollments in the active company's courses. */
export async function getLegacyEnrollments(): Promise<LegacyEnrollment[]> {
  const companyId = activeCompanyId();
  const userId = await ensureInternalUser();
  if (!companyId || !userId) return [];
  const { data, error } = await db().from("course_enrollments")
    .select("*, courses!inner(*)")
    .eq("user_id", userId).eq("courses.company_id", companyId)
    .not("status", "in", "(cancelled,refunded,expired)");
  if (error) { console.error("Training: getEnrollments error:", error); return []; }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    student_id: r.user_id as string,
    course_id: r.course_id as string,
    enrollment_status: r.status as string,
    enrollment_type: (r.enrollment_type as string | null) ?? "assigned",
    completion_percentage: Number(r.progress ?? 0),
    amount_paid: r.amount_paid == null ? null : Number(r.amount_paid),
    purchase_date: String(r.started_at ?? r.assigned_at ?? ""),
    courses: r.courses ? toCourse(r.courses as CourseRow) : undefined,
  }));
}

type CourseFields = {
  course_code: string; course_name: string; description: string; short_description: string;
  price: number; duration_hours: number; difficulty_level: string; target_audience: string;
  learning_objectives: string[]; is_active: boolean; is_featured: boolean; display_order: number;
};

export async function createLegacyCourse(courseData: Partial<CourseFields> & { course_code: string; course_name: string }): Promise<WriteResult> {
  const companyId = activeCompanyId();
  if (!companyId) return { success: false, error: "missing_company" };
  const id = crypto.randomUUID();
  const { error } = await db().from("courses").insert({
    id, company_id: companyId, title: courseData.course_name, is_active: true, is_featured: false,
    display_order: 999, ...courseData, updated_at: nowIso(),
  });
  if (error) return fail("createCourse", error);
  return { success: true, id };
}

export async function updateLegacyCourse(courseId: string, updates: Partial<CourseFields>): Promise<WriteResult> {
  const row: Record<string, unknown> = { ...updates, updated_at: nowIso() };
  if (updates.course_name) row.title = updates.course_name;
  const { data, error } = await db().from("courses").update(row).eq("id", courseId).select("id");
  if (error) return fail("updateCourse", error);
  return rowsOrMissing(data);
}

/** Server-side: refuses with course_in_use while enrollments or payments reference it. */
export async function deleteLegacyCourse(courseId: string): Promise<WriteResult> {
  const { error } = await db().rpc("training_delete_course", { p_course_id: courseId });
  if (error) return fail("deleteCourse", error);
  return { success: true };
}
