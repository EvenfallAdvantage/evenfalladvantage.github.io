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

export type LegacyCrimeData = {
  violent_crime_rate: number;
  property_crime_rate: number;
  total_crime_rate: number;
  population: number;
  granularity: "city" | "county" | "state";
  location_name: string;
  data_source: string;
  murder_rate?: number;
  rape_rate?: number;
  robbery_rate?: number;
  aggravated_assault_rate?: number;
  burglary_rate?: number;
  larceny_theft_rate?: number;
  motor_vehicle_theft_rate?: number;
  arson_rate?: number;
  violent_clearance_rate?: number;
  property_clearance_rate?: number;
  violent_crime_trend?: string;
  property_crime_trend?: string;
  year_over_year_change?: number;
  previous_year_violent_rate?: number;
  top_violent_crime_type?: string;
  top_property_crime_type?: string;
  area_square_miles?: number;
  crime_density?: number;
  data_quality?: string;
};
