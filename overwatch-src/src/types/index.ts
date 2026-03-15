export type NavItem = {
  title: string;
  href: string;
  icon: string;
  badge?: number;
  roles?: string[];
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
