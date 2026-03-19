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

export type CompanySettings = {
  hiddenTabs?: string[];
};

export type CompanyContext = {
  companyId: string;
  companyName: string;
  companySlug: string;
  companyLogo: string | null;
  brandColor: string;
  role: string;
  settings: CompanySettings;
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
  website_url?: string;
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

// ─── Core DB Row Types ───────────────────────────────

export type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  join_code: string;
  timezone: string;
  brand_color: string;
  settings: CompanySettings & Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CompanyMembershipRow = {
  id: string;
  user_id: string;
  company_id: string;
  role: string;
  title: string | null;
  nickname: string | null;
  pronouns: string | null;
  bio: string | null;
  dietary_preferences: string | null;
  shirt_size: string | null;
  jacket_size: string | null;
  guard_card_number: string | null;
  guard_card_expiry: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  address: string | null;
  hire_date: string | null;
  status: string;
  work_preferences: string[];
  whatsapp_opted_in: boolean;
  onboarding_complete: boolean;
  kiosk_pin: string | null;
  qr_code_id: string | null;
  notification_days: string[];
  notifications_muted: boolean;
  created_at: string;
  updated_at: string;
  // joined
  users?: { id: string; email: string | null; phone: string | null; first_name: string; last_name: string; avatar_url: string | null; supabase_id: string };
};

// ─── Scheduling & Timekeeping ────────────────────────

export type EventRow = {
  id: string;
  company_id: string;
  client_id: string | null;
  name: string;
  description: string | null;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
  geofence_radius_meters: number | null;
  start_date: string;
  end_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  clients?: { name: string; contact_name: string | null } | null;
  shifts?: ShiftRow[];
};

export type ShiftRow = {
  id: string;
  event_id: string;
  assigned_user_id: string | null;
  role: string | null;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  users?: { id: string; first_name: string; last_name: string; avatar_url: string | null } | null;
  events?: { name: string; location: string | null; company_id: string } | null;
};

export type TimesheetRow = {
  id: string;
  user_id: string;
  shift_id: string | null;
  clock_in: string;
  clock_out: string | null;
  clock_method: string;
  break_minutes: number;
  approved: boolean;
  approved_by_id: string | null;
  approved_at: string | null;
  qb_synced: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  users?: { first_name: string; last_name: string; avatar_url: string | null };
  shifts?: { events?: { name: string; location: string | null } | null } | null;
};

export type TimeChangeRequestRow = {
  id: string;
  timesheet_id: string;
  user_id: string;
  company_id: string;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  reason: string;
  status: "pending" | "approved" | "denied";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  // joined
  users?: { first_name: string; last_name: string };
  timesheets?: { clock_in: string; clock_out: string | null };
};

// ─── Leave ───────────────────────────────────────────

export type TimeOffRequestRow = {
  id: string;
  user_id: string;
  policy_id: string;
  start_date: string;
  end_date: string;
  note: string | null;
  status: string;
  reviewed_by_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  // joined
  users?: { first_name: string; last_name: string };
  time_off_policies?: { name: string; company_id: string };
};

// ─── Feed & Social ───────────────────────────────────

export type PostRow = {
  id: string;
  company_id: string;
  user_id: string;
  type: string;
  title: string | null;
  content: string;
  image_url: string | null;
  link_url: string | null;
  is_pinned: boolean;
  publish_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  users?: { first_name: string; last_name: string; avatar_url: string | null };
};

export type PostCommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  users?: { first_name: string; last_name: string; avatar_url: string | null };
};

export type PostReactionRow = {
  id: string;
  post_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

// ─── Incidents & Patrols ─────────────────────────────

export type IncidentRow = {
  id: string;
  company_id: string;
  reported_by: string;
  assigned_to: string | null;
  event_id: string | null;
  title: string;
  description: string | null;
  type: string;
  severity: string;
  priority: string;
  status: string;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
  resolution: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  reporter?: { first_name: string; last_name: string } | null;
  assignee?: { first_name: string; last_name: string } | null;
};

// ─── Forms ───────────────────────────────────────────

export type FormSubmissionRow = {
  id: string;
  form_id: string;
  user_id: string;
  data: Record<string, unknown>;
  status: string;
  reviewed_by_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  // joined
  users?: { first_name: string; last_name: string };
  forms?: { name: string };
};

// ─── Notifications ───────────────────────────────────

export type NotificationRow = {
  id: string;
  user_id: string;
  company_id: string;
  title: string;
  body: string | null;
  type: string;
  read: boolean;
  action_url: string | null;
  created_at: string;
};

// ─── Onboarding ──────────────────────────────────────

export type ApplicantRow = {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  guard_card_number: string | null;
  guard_card_expiry: string | null;
  work_preferences: string[];
  availability: string | null;
  experience: string | null;
  resume_url: string | null;
  cover_letter: string | null;
  source: string;
  status: string;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  hired_at: string | null;
  converted_user_id: string | null;
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// ─── Chat ────────────────────────────────────────────

export type ChatChannelRow = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  type: string;
  is_archived: boolean;
  created_at: string;
};

export type ChatMessageRow = {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  file_url: string | null;
  reply_to_id: string | null;
  created_at: string;
  edited_at: string | null;
  // joined
  users?: { first_name: string; last_name: string; avatar_url: string | null };
};

// ─── Knowledge Base ──────────────────────────────────

export type KBFolderRow = {
  id: string;
  company_id: string;
  parent_id: string | null;
  name: string;
  icon: string | null;
  sort_order: number;
  created_at: string;
};

export type KBDocumentRow = {
  id: string;
  folder_id: string;
  title: string;
  type: string;
  content: string | null;
  file_url: string | null;
  sort_order: number;
  created_by_id: string;
  created_at: string;
  updated_at: string;
};

// ─── Audit ───────────────────────────────────────────

export type AuditLogRow = {
  id: string;
  company_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

// ─── Client ──────────────────────────────────────────

export type ClientRow = {
  id: string;
  company_id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Assessment Questions ────────────────────────────

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
