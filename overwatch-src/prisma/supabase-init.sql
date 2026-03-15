-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('owner', 'admin', 'manager', 'lead', 'breaker', 'staff');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "supabase_id" TEXT,
    "is_platform_admin" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "join_code" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "brand_color" TEXT NOT NULL DEFAULT '#6366f1',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "role" "CompanyRole" NOT NULL DEFAULT 'staff',
    "title" TEXT,
    "nickname" TEXT,
    "pronouns" TEXT,
    "bio" TEXT,
    "dietary_preferences" TEXT,
    "shirt_size" TEXT,
    "jacket_size" TEXT,
    "guard_card_number" TEXT,
    "guard_card_expiry" TIMESTAMP(3),
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "address" TEXT,
    "hire_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "work_preferences" TEXT[],
    "whatsapp_opted_in" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
    "kiosk_pin" TEXT,
    "qr_code_id" TEXT,
    "notification_days" TEXT[] DEFAULT ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']::TEXT[],
    "notifications_muted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "client_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "location_lat" DOUBLE PRECISION,
    "location_lng" DOUBLE PRECISION,
    "geofence_radius_meters" INTEGER,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "whatsapp_group_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_interests" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'interested',
    "responded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),

    CONSTRAINT "event_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "assigned_user_id" UUID,
    "role" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "shift_id" UUID,
    "clock_in" TIMESTAMP(3) NOT NULL,
    "clock_out" TIMESTAMP(3),
    "clock_method" TEXT NOT NULL DEFAULT 'app',
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "qb_synced" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_off_policies" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "accrual_rate" DOUBLE PRECISION,
    "accrual_period" TEXT,
    "max_balance" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_off_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_off_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_off_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "asset_type" TEXT,
    "serial_number" TEXT,
    "qr_code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "condition" TEXT NOT NULL DEFAULT 'good',
    "current_holder_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_logs" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "event_id" UUID,
    "action" TEXT NOT NULL,
    "condition_at_action" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "cert_type" TEXT NOT NULL,
    "issue_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "document_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forms" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "icon" TEXT,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submissions" (
    "id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "passing_score" INTEGER NOT NULL DEFAULT 70,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "time_limit_min" INTEGER,
    "icon" TEXT,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "score" INTEGER,
    "passed" BOOLEAN,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" JSONB NOT NULL DEFAULT '[]',
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "passing_score" INTEGER NOT NULL DEFAULT 70,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_enrollments" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_folders" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_documents" (
    "id" UUID NOT NULL,
    "folder_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'page',
    "content" TEXT,
    "file_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kb_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_channels" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'group',
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_members" (
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_read_at" TIMESTAMP(3),

    CONSTRAINT "chat_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "file_url" TEXT,
    "reply_to_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'update',
    "title" TEXT,
    "content" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "publish_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comments" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_reactions" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "type" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "action_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_supabase_id_key" ON "users"("supabase_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "companies_join_code_key" ON "companies"("join_code");

-- CreateIndex
CREATE INDEX "company_memberships_company_id_idx" ON "company_memberships"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_memberships_user_id_company_id_key" ON "company_memberships"("user_id", "company_id");

-- CreateIndex
CREATE INDEX "clients_company_id_idx" ON "clients"("company_id");

-- CreateIndex
CREATE INDEX "events_company_id_status_idx" ON "events"("company_id", "status");

-- CreateIndex
CREATE INDEX "events_start_date_idx" ON "events"("start_date");

-- CreateIndex
CREATE UNIQUE INDEX "event_interests_event_id_user_id_key" ON "event_interests"("event_id", "user_id");

-- CreateIndex
CREATE INDEX "shifts_event_id_idx" ON "shifts"("event_id");

-- CreateIndex
CREATE INDEX "shifts_assigned_user_id_idx" ON "shifts"("assigned_user_id");

-- CreateIndex
CREATE INDEX "shifts_start_time_idx" ON "shifts"("start_time");

-- CreateIndex
CREATE INDEX "timesheets_user_id_idx" ON "timesheets"("user_id");

-- CreateIndex
CREATE INDEX "timesheets_clock_in_idx" ON "timesheets"("clock_in");

-- CreateIndex
CREATE INDEX "time_off_policies_company_id_idx" ON "time_off_policies"("company_id");

-- CreateIndex
CREATE INDEX "time_off_requests_user_id_idx" ON "time_off_requests"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "assets_qr_code_key" ON "assets"("qr_code");

-- CreateIndex
CREATE INDEX "assets_company_id_status_idx" ON "assets"("company_id", "status");

-- CreateIndex
CREATE INDEX "asset_logs_asset_id_idx" ON "asset_logs"("asset_id");

-- CreateIndex
CREATE INDEX "asset_logs_company_id_idx" ON "asset_logs"("company_id");

-- CreateIndex
CREATE INDEX "certifications_user_id_idx" ON "certifications"("user_id");

-- CreateIndex
CREATE INDEX "certifications_expiry_date_idx" ON "certifications"("expiry_date");

-- CreateIndex
CREATE INDEX "forms_company_id_idx" ON "forms"("company_id");

-- CreateIndex
CREATE INDEX "form_submissions_form_id_idx" ON "form_submissions"("form_id");

-- CreateIndex
CREATE INDEX "form_submissions_user_id_idx" ON "form_submissions"("user_id");

-- CreateIndex
CREATE INDEX "quizzes_company_id_idx" ON "quizzes"("company_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_quiz_id_idx" ON "quiz_attempts"("quiz_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_user_id_idx" ON "quiz_attempts"("user_id");

-- CreateIndex
CREATE INDEX "courses_company_id_idx" ON "courses"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_enrollments_course_id_user_id_key" ON "course_enrollments"("course_id", "user_id");

-- CreateIndex
CREATE INDEX "kb_folders_company_id_idx" ON "kb_folders"("company_id");

-- CreateIndex
CREATE INDEX "kb_documents_folder_id_idx" ON "kb_documents"("folder_id");

-- CreateIndex
CREATE INDEX "chat_channels_company_id_idx" ON "chat_channels"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_members_channel_id_user_id_key" ON "chat_members"("channel_id", "user_id");

-- CreateIndex
CREATE INDEX "chat_messages_channel_id_created_at_idx" ON "chat_messages"("channel_id", "created_at");

-- CreateIndex
CREATE INDEX "posts_company_id_created_at_idx" ON "posts"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "post_comments_post_id_idx" ON "post_comments"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_reactions_post_id_user_id_emoji_key" ON "post_reactions"("post_id", "user_id", "emoji");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");

-- CreateIndex
CREATE INDEX "notifications_company_id_idx" ON "notifications"("company_id");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at");

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_interests" ADD CONSTRAINT "event_interests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_interests" ADD CONSTRAINT "event_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off_policies" ADD CONSTRAINT "time_off_policies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "time_off_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_current_holder_id_fkey" FOREIGN KEY ("current_holder_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_logs" ADD CONSTRAINT "asset_logs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_logs" ADD CONSTRAINT "asset_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_logs" ADD CONSTRAINT "asset_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_logs" ADD CONSTRAINT "asset_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_folders" ADD CONSTRAINT "kb_folders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_folders" ADD CONSTRAINT "kb_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "kb_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_documents" ADD CONSTRAINT "kb_documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "kb_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_documents" ADD CONSTRAINT "kb_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
