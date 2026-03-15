-- ============================================================
-- OVERWATCH — Supabase Database Setup
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── CORE TABLES ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE,
  phone         TEXT UNIQUE,
  first_name    TEXT NOT NULL DEFAULT '',
  last_name     TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT,
  supabase_id   TEXT UNIQUE,
  is_platform_admin BOOLEAN DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  logo_url    TEXT,
  join_code   TEXT UNIQUE NOT NULL,
  timezone    TEXT DEFAULT 'America/Los_Angeles',
  brand_color TEXT DEFAULT '#1d3451',
  settings    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_memberships (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role                  TEXT DEFAULT 'staff',
  title                 TEXT,
  nickname              TEXT,
  pronouns              TEXT,
  bio                   TEXT,
  dietary_preferences   TEXT,
  shirt_size            TEXT,
  jacket_size           TEXT,
  guard_card_number     TEXT,
  guard_card_expiry     TIMESTAMPTZ,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  address               TEXT,
  hire_date             TIMESTAMPTZ,
  status                TEXT DEFAULT 'active',
  work_preferences      TEXT[] DEFAULT '{}',
  whatsapp_opted_in     BOOLEAN DEFAULT false,
  onboarding_complete   BOOLEAN DEFAULT false,
  kiosk_pin             TEXT,
  qr_code_id            TEXT,
  notification_days     TEXT[] DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  notifications_muted   BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- ─── EVENTS & SCHEDULING ───────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  contact_name  TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address       TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id         UUID REFERENCES clients(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  location          TEXT,
  location_lat      DOUBLE PRECISION,
  location_lng      DOUBLE PRECISION,
  geofence_radius_meters INT,
  start_date        TIMESTAMPTZ NOT NULL,
  end_date          TIMESTAMPTZ NOT NULL,
  status            TEXT DEFAULT 'draft',
  whatsapp_group_id TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_interests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT DEFAULT 'interested',
  responded_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role            TEXT,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL,
  status          TEXT DEFAULT 'open',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS timesheets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_id      UUID REFERENCES shifts(id) ON DELETE SET NULL,
  clock_in      TIMESTAMPTZ NOT NULL,
  clock_out     TIMESTAMPTZ,
  clock_method  TEXT DEFAULT 'app',
  break_minutes INT DEFAULT 0,
  approved      BOOLEAN DEFAULT false,
  approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at   TIMESTAMPTZ,
  qb_synced     BOOLEAN DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── ASSETS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  asset_type      TEXT,
  serial_number   TEXT,
  qr_code         TEXT UNIQUE NOT NULL,
  status          TEXT DEFAULT 'available',
  condition       TEXT DEFAULT 'good',
  current_holder_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asset_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id          UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_id          UUID REFERENCES events(id) ON DELETE SET NULL,
  action            TEXT NOT NULL,
  condition_at_action TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ─── FORMS & REPORTS ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  fields      JSONB DEFAULT '[]',
  icon        TEXT,
  color       TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS form_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data          JSONB DEFAULT '{}',
  status        TEXT DEFAULT 'submitted',
  reviewed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  review_note   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── TRAINING / LMS ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS courses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  content       JSONB DEFAULT '[]',
  is_required   BOOLEAN DEFAULT false,
  passing_score INT DEFAULT 70,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT DEFAULT 'assigned',
  progress    INT DEFAULT 0,
  score       INT,
  started_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, user_id)
);

CREATE TABLE IF NOT EXISTS quizzes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  questions     JSONB DEFAULT '[]',
  passing_score INT DEFAULT 70,
  max_attempts  INT DEFAULT 3,
  time_limit_min INT,
  icon          TEXT,
  color         TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id      UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers      JSONB DEFAULT '{}',
  score        INT,
  passed       BOOLEAN,
  started_at   TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ─── CERTIFICATIONS ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS certifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cert_type   TEXT NOT NULL,
  issue_date  TIMESTAMPTZ,
  expiry_date TIMESTAMPTZ,
  document_url TEXT,
  status      TEXT DEFAULT 'active',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── TIME OFF ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS time_off_policies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,
  accrual_rate  DOUBLE PRECISION,
  accrual_period TEXT,
  max_balance   DOUBLE PRECISION,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS time_off_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_id     UUID NOT NULL REFERENCES time_off_policies(id) ON DELETE CASCADE,
  start_date    TIMESTAMPTZ NOT NULL,
  end_date      TIMESTAMPTZ NOT NULL,
  note          TEXT,
  status        TEXT DEFAULT 'pending',
  reviewed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── KNOWLEDGE BASE ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kb_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES kb_folders(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  icon        TEXT,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kb_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id     UUID NOT NULL REFERENCES kb_folders(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  type          TEXT DEFAULT 'page',
  content       TEXT,
  file_url      TEXT,
  sort_order    INT DEFAULT 0,
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── CHAT ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  type        TEXT DEFAULT 'group',
  is_archived BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT DEFAULT 'member',
  joined_at   TIMESTAMPTZ DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  UNIQUE(channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  file_url    TEXT,
  reply_to_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  edited_at   TIMESTAMPTZ
);

-- ─── POSTS / FEED ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT DEFAULT 'update',
  title       TEXT,
  content     TEXT NOT NULL,
  is_pinned   BOOLEAN DEFAULT false,
  publish_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_comments (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id   UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_reactions (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id   UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji     TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id, emoji)
);

-- ─── NOTIFICATIONS & AUDIT ──────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT,
  type        TEXT NOT NULL,
  read        BOOLEAN DEFAULT false,
  action_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── INDEXES ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_supabase ON users(supabase_id);
CREATE INDEX IF NOT EXISTS idx_memberships_company ON company_memberships(company_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON company_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_events_company ON events(company_id, status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_shifts_event ON shifts(event_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user ON shifts(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_time ON shifts(start_time);
CREATE INDEX IF NOT EXISTS idx_timesheets_user ON timesheets(user_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_clock ON timesheets(clock_in);
CREATE INDEX IF NOT EXISTS idx_assets_company ON assets(company_id, status);
CREATE INDEX IF NOT EXISTS idx_asset_logs_asset ON asset_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_forms_company ON forms(company_id);
CREATE INDEX IF NOT EXISTS idx_form_subs_form ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_subs_user ON form_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_company ON quizzes(company_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_certs_user ON certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_certs_expiry ON certifications(expiry_date);
CREATE INDEX IF NOT EXISTS idx_time_off_user ON time_off_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_kb_folders_company ON kb_folders(company_id);
CREATE INDEX IF NOT EXISTS idx_kb_docs_folder ON kb_documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_chat_channels_company ON chat_channels(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_msgs_channel ON chat_messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_posts_company ON posts(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_post_comments ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_logs(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_courses_company ON courses(company_id);
CREATE INDEX IF NOT EXISTS idx_time_off_policies_company ON time_off_policies(company_id);

-- ─── ROW LEVEL SECURITY ────────────────────────────────────
-- Enable RLS on all tables, then grant access based on auth.uid()

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ─── RLS POLICIES: USERS ────────────────────────────────────
-- Authenticated users can read all users (for roster)
-- Users can insert/update their own record (matched by supabase_id)

CREATE POLICY "users_select" ON users FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "users_insert" ON users FOR INSERT TO authenticated
  WITH CHECK (supabase_id = auth.uid()::text);

CREATE POLICY "users_update" ON users FOR UPDATE TO authenticated
  USING (supabase_id = auth.uid()::text);

-- ─── RLS POLICIES: COMPANIES ────────────────────────────────
-- Authenticated users can read companies (needed for join by code)
-- Authenticated users can create companies (register flow)

CREATE POLICY "companies_select" ON companies FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "companies_insert" ON companies FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "companies_update" ON companies FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT cm.company_id FROM company_memberships cm
      JOIN users u ON u.id = cm.user_id
      WHERE u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin')
    )
  );

-- ─── RLS POLICIES: MEMBERSHIPS ──────────────────────────────
-- Can read memberships for companies you belong to
-- Can insert membership for yourself

CREATE POLICY "memberships_select" ON company_memberships FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "memberships_insert" ON company_memberships FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE supabase_id = auth.uid()::text
    )
  );

CREATE POLICY "memberships_update" ON company_memberships FOR UPDATE TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE supabase_id = auth.uid()::text
    )
  );

-- ─── RLS POLICIES: COMPANY-SCOPED TABLES ────────────────────
-- For all company-scoped tables: allow access if user is member of that company

-- Helper function for checking company membership
CREATE OR REPLACE FUNCTION is_company_member(comp_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_memberships cm
    JOIN users u ON u.id = cm.user_id
    WHERE u.supabase_id = auth.uid()::text
    AND cm.company_id = comp_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Timesheets: users can manage their own
CREATE POLICY "timesheets_select" ON timesheets FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));

CREATE POLICY "timesheets_insert" ON timesheets FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));

CREATE POLICY "timesheets_update" ON timesheets FOR UPDATE TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));

-- Generic company-scoped policies (events, assets, forms, etc.)
-- Tables WITH a direct company_id column
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'clients', 'events', 'assets', 'asset_logs', 'forms',
    'courses', 'quizzes',
    'time_off_policies', 'kb_folders', 'chat_channels',
    'posts', 'notifications', 'audit_logs'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (is_company_member(company_id))',
      tbl || '_select', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id))',
      tbl || '_insert', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (is_company_member(company_id))',
      tbl || '_update', tbl
    );
  END LOOP;
END $$;

-- Tables WITHOUT company_id — use user_id or parent reference
CREATE POLICY "form_submissions_select" ON form_submissions FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));
CREATE POLICY "form_submissions_insert" ON form_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));
CREATE POLICY "form_submissions_update" ON form_submissions FOR UPDATE TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));

CREATE POLICY "course_enrollments_select" ON course_enrollments FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));
CREATE POLICY "course_enrollments_insert" ON course_enrollments FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));

CREATE POLICY "quiz_attempts_select" ON quiz_attempts FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));
CREATE POLICY "quiz_attempts_insert" ON quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));

-- Tables without company_id — use parent reference
CREATE POLICY "event_interests_select" ON event_interests FOR SELECT TO authenticated USING (true);
CREATE POLICY "event_interests_insert" ON event_interests FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "shifts_select" ON shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "shifts_insert" ON shifts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "shifts_update" ON shifts FOR UPDATE TO authenticated USING (true);

CREATE POLICY "certifications_select" ON certifications FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));
CREATE POLICY "certifications_insert" ON certifications FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));

CREATE POLICY "time_off_requests_select" ON time_off_requests FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));
CREATE POLICY "time_off_requests_insert" ON time_off_requests FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));

CREATE POLICY "kb_documents_select" ON kb_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "kb_documents_insert" ON kb_documents FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "chat_members_select" ON chat_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "chat_members_insert" ON chat_members FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "chat_messages_select" ON chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "chat_messages_insert" ON chat_messages FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "post_comments_select" ON post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "post_comments_insert" ON post_comments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "post_reactions_select" ON post_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "post_reactions_insert" ON post_reactions FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- ✅ Setup complete! All 28 tables + indexes + RLS policies created.
-- ============================================================
