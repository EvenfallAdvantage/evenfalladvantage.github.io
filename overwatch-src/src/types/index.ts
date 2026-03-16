export type NavItem = {
  title: string;
  href: string;
  icon: string;
  badge?: number;
  roles?: string[];
  superAdminOnly?: boolean;
  section?: string;
  children?: NavItem[];
};

export type CompanyContext = {
  companyId: string;
  companyName: string;
  companySlug: string;
  companyLogo: string | null;
  brandColor: string;
  role: string;
  membership: {
    id: string;
    nickname: string | null;
    status: string;
  };
};

export type SessionUser = {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isPlatformAdmin: boolean;
  companies: CompanyContext[];
  activeCompanyId: string | null;
};

// ─── LMS Types ────────────────────────────────────────

export type TrainingModule = {
  id: string;
  company_id: string;
  module_code: string;
  module_name: string;
  description: string | null;
  icon: string;
  duration_minutes: number;
  difficulty_level: "Beginner" | "Intermediate" | "Advanced" | "Critical" | "Essential";
  is_required: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  // joined fields
  slides?: ModuleSlide[];
  slide_count?: number;
  progress?: StudentModuleProgress | null;
};

export type ModuleSlide = {
  id: string;
  module_id: string;
  title: string;
  content_html: string;
  audio_url: string | null;
  image_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type StudentModuleProgress = {
  id: string;
  user_id: string;
  module_id: string;
  status: "not_started" | "in_progress" | "completed";
  progress_percentage: number;
  current_slide: number;
  started_at: string | null;
  completed_at: string | null;
  last_accessed_at: string;
  created_at: string;
  updated_at: string;
};

// ─── DB Payload Types (replace `any` in domain modules) ─

export type UserProfilePayload = {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  avatar_url?: string;
};

export type CompanyPayload = {
  name?: string;
  brand_color?: string;
  timezone?: string;
  logo_url?: string;
};

export type QuizPayload = {
  updated_at: string;
  questions?: unknown[];
  title?: string;
  description?: string;
  passing_score?: number;
  module_id?: string | null;
};

export type FormPayload = {
  updated_at: string;
  fields?: unknown[];
  name?: string;
  description?: string;
};

export type UserName = {
  first_name: string;
  last_name: string;
};

export type CertificationRow = {
  id: string;
  user_id: string;
  cert_type: string;
  issue_date: string | null;
  expiry_date: string | null;
  document_url: string | null;
  certificate_number: string | null;
  issued_by: string | null;
  pdf_url: string | null;
  verification_code: string | null;
  category: string;
  company_id: string | null;
  module_id: string | null;
  quiz_id: string | null;
  status: string;
  created_at: string;
};

export type AssessmentQuestion = {
  id: string;
  company_id: string;
  module_id: string | null;
  question_text: string;
  question_type: "multiple_choice" | "true_false" | "short_answer";
  options: string[];
  correct_answer: string;
  explanation: string | null;
  difficulty: "easy" | "medium" | "hard";
  category: string | null;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // joined
  training_module?: { module_name: string; module_code: string } | null;
};
