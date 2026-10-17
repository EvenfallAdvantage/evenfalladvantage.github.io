// UI shapes for the training layer. Names keep the old Legacy* prefix (they were the EADB
// shapes) so the Instructor HQ / Academy screens didn't need a rewrite; rename is a follow-up.

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
  /** Same as content_html (kept for older callers). */
  content: string | null;
  content_html: string | null;
  /** module_slides.sort_order */
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
  /** training_classes.instructor_user_id (an OverwatchDB users.id) */
  instructor_id: string;
  class_name: string;
  class_type?: string | null;
  description: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  /** training_classes.capacity */
  max_students: number | null;
  status: string;
  enrollments?: { count: number }[];
};

/** A learner of the active company (OverwatchDB users.id). */
export type LegacyStudent = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
  last_login: string | null;
  /** false = imported from EADB, hasn't accepted an Overwatch invite yet (phase 4). */
  has_login: boolean;
  member_role: string | null;
};

export type ClassEnrollmentRow = {
  student_id: string;
  enrollment_status: string;
  student: { first_name: string; last_name: string; email: string } | null;
};

export type ClassAttendanceRow = {
  student_id: string;
  status: string;
  notes: string | null;
  marked_at: string;
  student: { first_name: string; last_name: string; email: string } | null;
};
