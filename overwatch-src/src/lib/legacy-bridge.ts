/**
 * Legacy Bridge — Cross-database read/write service
 * 
 * Connects Overwatch to the legacy Evenfall Advantage Supabase instance
 * to pull training content, progress, assessments, and certificates.
 * 
 * Legacy Supabase: vaagvairvwmgyzsmymhs.supabase.co
 * Overwatch Supabase: nneueuvyeohwnspbwfub.supabase.co
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Legacy Supabase credentials (read-scoped via RLS)
const LEGACY_URL = "https://vaagvairvwmgyzsmymhs.supabase.co";
const LEGACY_ANON_KEY = "sb_publishable_IPcFlKw8LEGnk2NYg5qrsw_Rq8yIhR1";

let _legacyClient: SupabaseClient | null = null;

/** Get or create the legacy Supabase client (singleton) */
export function getLegacyClient(): SupabaseClient {
  if (!_legacyClient) {
    _legacyClient = createClient(LEGACY_URL, LEGACY_ANON_KEY);
  }
  return _legacyClient;
}

// ─── Types ────────────────────────────────────────────

export type LegacyCourse = {
  id: string;
  course_code: string;
  course_name: string;
  description: string | null;
  short_description: string | null;
  price: number;
  duration_hours: number | null;
  difficulty_level: string | null;
  icon: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  learning_objectives: string[] | null;
  target_audience: string | null;
  created_at: string;
};

export type LegacyModule = {
  id: string;
  module_code: string;
  module_name: string;
  description: string | null;
  icon: string | null;
  difficulty_level: string | null;
  estimated_time: string | null;
  duration_minutes: number | null;
  is_active: boolean;
  display_order: number;
  default_course_id: string | null;
};

export type LegacyCourseModule = {
  id: string;
  course_id: string;
  module_id: string;
  module_order: number;
  is_required: boolean;
  training_modules?: LegacyModule;
};

export type LegacySlide = {
  id: string;
  module_id: string;
  title: string;
  content: string | null;
  content_html: string | null;
  slide_number: number;
  slide_type: string | null;
  image_url: string | null;
  audio_url: string | null;
};

export type LegacyModuleProgress = {
  id: string;
  student_id: string;
  module_id: string;
  status: string;
  progress_percentage: number;
  current_slide: number | null;
  completed_at: string | null;
  last_accessed_at: string | null;
  training_modules?: {
    module_name: string;
    module_code: string;
    description: string | null;
  };
};

export type LegacyAssessment = {
  id: string;
  assessment_name: string;
  module_id: string | null;
  total_questions: number;
  passing_score: number;
};

export type LegacyAssessmentResult = {
  id: string;
  student_id: string;
  assessment_id: string;
  score: number;
  passed: boolean;
  state_code: string | null;
  completed_at: string;
  assessments?: {
    assessment_name: string;
    module_id: string | null;
    total_questions: number;
    passing_score: number;
  };
};

export type LegacyCertificate = {
  id: string;
  certificate_number: string;
  student_id: string;
  issued_by: string | null;
  certificate_type: string;
  certificate_name: string | null;
  state_issued: string | null;
  issue_date: string;
  expiration_date: string | null;
  verification_code: string | null;
  status: string;
  issued_by_instructor?: {
    first_name: string;
    last_name: string;
  };
};

export type LegacyEnrollment = {
  id: string;
  student_id: string;
  course_id: string;
  enrollment_status: string;
  enrollment_type: string;
  completion_percentage: number;
  amount_paid: number | null;
  purchase_date: string;
  courses?: LegacyCourse;
};

export type LegacyScheduledClass = {
  id: string;
  instructor_id: string;
  class_name: string;
  description: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  max_students: number | null;
  status: string;
  enrollments?: { count: number }[];
  instructor?: { first_name: string; last_name: string; email: string };
};

export type LegacyStudent = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
  last_login: string | null;
  student_profiles?: Array<{
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  }>;
};

// ─── Read Functions ───────────────────────────────────

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

/** Get all training modules from legacy */
export async function getLegacyModules(): Promise<LegacyModule[]> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("training_modules")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Legacy: getModules error:", error);
    return [];
  }
  return data ?? [];
}

/** Get slides for a module */
export async function getLegacySlides(moduleId: string): Promise<LegacySlide[]> {
  const client = getLegacyClient();

  const { data, error } = await client
    .from("module_slides")
    .select("*")
    .eq("module_id", moduleId)
    .order("slide_number", { ascending: true });

  if (error) {
    console.error("Legacy: getSlides error:", error);
    return [];
  }
  return data ?? [];
}

/** Get student module progress */
export async function getLegacyProgress(studentId: string): Promise<LegacyModuleProgress[]> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("student_module_progress")
    .select(`
      *,
      training_modules (
        module_name,
        module_code,
        description
      )
    `)
    .eq("student_id", studentId);

  if (error) {
    console.error("Legacy: getProgress error:", error);
    return [];
  }
  return data ?? [];
}

/** Get assessment results for a student */
export async function getLegacyAssessmentResults(studentId: string): Promise<LegacyAssessmentResult[]> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("assessment_results")
    .select(`
      *,
      assessments (
        assessment_name,
        module_id,
        total_questions,
        passing_score
      )
    `)
    .eq("student_id", studentId)
    .order("completed_at", { ascending: false });

  if (error) {
    console.error("Legacy: getAssessmentResults error:", error);
    return [];
  }
  return data ?? [];
}

/** Get certificates for a student */
export async function getLegacyCertificates(studentId: string): Promise<LegacyCertificate[]> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("certificates")
    .select(`
      *
    `)
    .eq("student_id", studentId)
    .order("issue_date", { ascending: false });

  if (error) {
    console.error("Legacy: getCertificates error:", error);
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

/** Get all assessments */
export async function getLegacyAssessments(): Promise<LegacyAssessment[]> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("assessments")
    .select("*")
    .order("assessment_name", { ascending: true });

  if (error) {
    console.error("Legacy: getAssessments error:", error);
    return [];
  }
  return data ?? [];
}

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

/** Get all students from legacy */
export async function getLegacyStudents(): Promise<LegacyStudent[]> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("students")
    .select(`
      *,
      student_profiles(*)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Legacy: getStudents error:", error);
    return [];
  }
  return data ?? [];
}

// ─── Write Functions (Account Linking) ────────────────

/** Create a student account in the legacy DB (for auto-linking) */
export async function createLegacyStudentProfile(
  userId: string,
  email: string,
  firstName: string,
  lastName: string
): Promise<{ success: boolean; error?: string }> {
  const client = getLegacyClient();

  // Check if student already exists
  const { data: existing } = await client
    .from("students")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return { success: true }; // Already exists
  }

  // Create student record (upsert to handle race conditions)
  const { error: studentError } = await client
    .from("students")
    .upsert({
      id: userId,
      email,
      first_name: firstName,
      last_name: lastName,
    }, { onConflict: "id" });

  if (studentError) {
    // 23505 = duplicate key — student already exists, treat as success
    if (studentError.code === "23505") {
      return { success: true };
    }
    console.error("Legacy: createStudent error:", studentError);
    return { success: false, error: studentError.message };
  }

  // Create profile
  const { error: profileError } = await client
    .from("student_profiles")
    .insert({ student_id: userId });

  if (profileError) {
    console.warn("Legacy: createProfile warning:", profileError.message);
    // Non-fatal — student exists
  }

  return { success: true };
}

/** Update module progress in legacy DB */
export async function updateLegacyProgress(
  studentId: string,
  moduleId: string,
  progressData: {
    progress_percentage: number;
    current_slide?: number;
    completed_at?: string | null;
  }
): Promise<{ success: boolean }> {
  const client = getLegacyClient();

  const status = progressData.progress_percentage === 100 ? "completed" : "in_progress";

  // Upsert
  const { data: existing } = await client
    .from("student_module_progress")
    .select("id")
    .eq("student_id", studentId)
    .eq("module_id", moduleId)
    .maybeSingle();

  if (existing) {
    const { error } = await client
      .from("student_module_progress")
      .update({ ...progressData, status })
      .eq("student_id", studentId)
      .eq("module_id", moduleId);

    if (error) {
      console.error("Legacy: updateProgress error:", error);
      return { success: false };
    }
  } else {
    const { error } = await client
      .from("student_module_progress")
      .insert({
        student_id: studentId,
        module_id: moduleId,
        ...progressData,
        status,
      });

    if (error) {
      console.error("Legacy: insertProgress error:", error);
      return { success: false };
    }
  }

  return { success: true };
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

// ─── Lookup Helpers ───────────────────────────────────

/** Find a legacy student by email */
export async function findLegacyStudentByEmail(email: string): Promise<LegacyStudent | null> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("students")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

// ─── Course / Module / Assessment CRUD ───────────────

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

/** Create a training module in legacy */
export async function createLegacyModule(moduleData: {
  module_code: string;
  module_name: string;
  description?: string;
  difficulty_level?: string;
  duration_minutes?: number;
  default_course_id?: string;
}): Promise<{ success: boolean; id?: string }> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("training_modules")
    .insert({ ...moduleData, is_active: true, display_order: 999 })
    .select("id")
    .single();
  if (error) { console.error("Legacy: createModule error:", error); return { success: false }; }
  return { success: true, id: data.id };
}

/** Update a training module in legacy */
export async function updateLegacyModule(moduleId: string, updates: Partial<{
  module_name: string;
  description: string;
  difficulty_level: string;
  duration_minutes: number;
  is_active: boolean;
  display_order: number;
}>): Promise<{ success: boolean }> {
  const client = getLegacyClient();
  const { error } = await client.from("training_modules").update(updates).eq("id", moduleId);
  if (error) { console.error("Legacy: updateModule error:", error); return { success: false }; }
  return { success: true };
}

/** Create a slide in legacy */
export async function createLegacySlide(slideData: {
  module_id: string;
  title: string;
  content_html?: string;
  slide_number: number;
  slide_type?: string;
  image_url?: string;
}): Promise<{ success: boolean; id?: string }> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("module_slides")
    .insert(slideData)
    .select("id")
    .single();
  if (error) { console.error("Legacy: createSlide error:", error); return { success: false }; }
  return { success: true, id: data.id };
}

/** Update a slide in legacy */
export async function updateLegacySlide(slideId: string, updates: Partial<{
  title: string;
  content_html: string;
  slide_number: number;
  slide_type: string;
  image_url: string;
}>): Promise<{ success: boolean }> {
  const client = getLegacyClient();
  const { error } = await client.from("module_slides").update(updates).eq("id", slideId);
  if (error) { console.error("Legacy: updateSlide error:", error); return { success: false }; }
  return { success: true };
}

/** Delete a slide in legacy */
export async function deleteLegacySlide(slideId: string): Promise<{ success: boolean }> {
  const client = getLegacyClient();
  const { error } = await client.from("module_slides").delete().eq("id", slideId);
  if (error) { console.error("Legacy: deleteSlide error:", error); return { success: false }; }
  return { success: true };
}

/** Create an assessment in legacy */
export async function createLegacyAssessment(assessmentData: {
  assessment_name: string;
  module_id?: string;
  total_questions: number;
  passing_score: number;
}): Promise<{ success: boolean; id?: string }> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("assessments")
    .insert(assessmentData)
    .select("id")
    .single();
  if (error) { console.error("Legacy: createAssessment error:", error); return { success: false }; }
  return { success: true, id: data.id };
}

/** Update an assessment in legacy */
export async function updateLegacyAssessment(assessmentId: string, updates: Partial<{
  assessment_name: string;
  module_id: string | null;
  total_questions: number;
  passing_score: number;
}>): Promise<{ success: boolean }> {
  const client = getLegacyClient();
  const { error } = await client.from("assessments").update(updates).eq("id", assessmentId);
  if (error) { console.error("Legacy: updateAssessment error:", error); return { success: false }; }
  return { success: true };
}

// ─── Phase 2: Write-Through Functions ────────────────

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

export type ClassEnrollmentRow = {
  student_id: string;
  enrollment_status: string;
  student: { first_name: string; last_name: string; email: string } | null;
};

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

export type ClassAttendanceRow = {
  student_id: string;
  status: string;
  notes: string | null;
  marked_at: string;
  student: { first_name: string; last_name: string; email: string } | null;
};

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

/** Issue a certificate to a student */
export async function issueLegacyCertificate(certData: {
  student_id: string;
  issued_by: string;
  certificate_type: string;
  certificate_name: string;
  state_issued?: string;
  expiration_date?: string;
}): Promise<{ success: boolean; id?: string }> {
  const client = getLegacyClient();

  const certNumber = `EA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const verificationCode = `V-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

  const { data, error } = await client
    .from("certificates")
    .insert({
      ...certData,
      certificate_number: certNumber,
      verification_code: verificationCode,
      issue_date: new Date().toISOString().split("T")[0],
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Legacy: issueCertificate error:", error);
    return { success: false };
  }
  return { success: true, id: data.id };
}

/** Save an assessment result in legacy */
export async function saveLegacyAssessmentResult(resultData: {
  student_id: string;
  assessment_id: string;
  score: number;
  passed: boolean;
  state_code?: string;
  answers?: Record<string, unknown>;
}): Promise<{ success: boolean }> {
  const client = getLegacyClient();
  const { error } = await client
    .from("assessment_results")
    .insert({
      ...resultData,
      completed_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Legacy: saveAssessmentResult error:", error);
    return { success: false };
  }
  return { success: true };
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
