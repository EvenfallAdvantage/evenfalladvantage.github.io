-- ============================================================
-- OVERWATCH — Enable RLS + Policies (standalone, safe to re-run)
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── 1. Enable RLS on ALL tables ──────────────────────────
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

-- ─── 2. Helper function ───────────────────────────────────
CREATE OR REPLACE FUNCTION is_company_member(comp_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_memberships cm
    JOIN users u ON u.id = cm.user_id
    WHERE u.supabase_id = auth.uid()::text
    AND cm.company_id = comp_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get the internal user id from auth.uid()
CREATE OR REPLACE FUNCTION get_my_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE supabase_id = auth.uid()::text LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── 3. Drop ALL existing policies (safe re-run) ─────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ─── 4. USERS ─────────────────────────────────────────────
-- Anyone authed can see users (for roster), but only own record for write
CREATE POLICY "users_select" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_insert" ON users FOR INSERT TO authenticated WITH CHECK (supabase_id = auth.uid()::text);
CREATE POLICY "users_update" ON users FOR UPDATE TO authenticated USING (supabase_id = auth.uid()::text);

-- ─── 5. COMPANIES ─────────────────────────────────────────
-- Anyone authed can read (needed for join by code), insert (register), owner/admin can update
CREATE POLICY "companies_select" ON companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies_insert" ON companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "companies_update" ON companies FOR UPDATE TO authenticated USING (is_company_member(id));

-- ─── 6. MEMBERSHIPS ──────────────────────────────────────
-- Can read all memberships in your companies; insert/update own
CREATE POLICY "memberships_select" ON company_memberships FOR SELECT TO authenticated
  USING (is_company_member(company_id));
CREATE POLICY "memberships_insert" ON company_memberships FOR INSERT TO authenticated
  WITH CHECK (user_id = get_my_user_id());
CREATE POLICY "memberships_update" ON company_memberships FOR UPDATE TO authenticated
  USING (user_id = get_my_user_id());

-- ─── 7. TIMESHEETS — user-scoped ─────────────────────────
CREATE POLICY "timesheets_select" ON timesheets FOR SELECT TO authenticated
  USING (user_id = get_my_user_id());
CREATE POLICY "timesheets_insert" ON timesheets FOR INSERT TO authenticated
  WITH CHECK (user_id = get_my_user_id());
CREATE POLICY "timesheets_update" ON timesheets FOR UPDATE TO authenticated
  USING (user_id = get_my_user_id());

-- ─── 8. COMPANY-SCOPED tables (have company_id column) ───
-- clients, events, assets, asset_logs, forms, courses, quizzes,
-- time_off_policies, kb_folders, chat_channels, posts, notifications, audit_logs
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'clients', 'events', 'assets', 'asset_logs', 'forms',
    'courses', 'quizzes', 'time_off_policies', 'kb_folders',
    'chat_channels', 'posts', 'notifications', 'audit_logs'
  ]
  LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (is_company_member(company_id))', tbl || '_select', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id))', tbl || '_insert', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (is_company_member(company_id))', tbl || '_update', tbl);
  END LOOP;
END $$;

-- ─── 9. USER-SCOPED tables (have user_id, no company_id) ─
-- form_submissions, course_enrollments, quiz_attempts, certifications, time_off_requests
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'form_submissions', 'course_enrollments', 'quiz_attempts',
    'certifications', 'time_off_requests'
  ]
  LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (user_id = get_my_user_id())', tbl || '_select', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (user_id = get_my_user_id())', tbl || '_insert', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (user_id = get_my_user_id())', tbl || '_update', tbl);
  END LOOP;
END $$;

-- ─── 10. PARENT-REFERENCED tables ────────────────────────
-- event_interests: via events → company_id
CREATE POLICY "event_interests_select" ON event_interests FOR SELECT TO authenticated
  USING (event_id IN (SELECT id FROM events WHERE is_company_member(company_id)));
CREATE POLICY "event_interests_insert" ON event_interests FOR INSERT TO authenticated
  WITH CHECK (user_id = get_my_user_id());

-- shifts: via events → company_id
CREATE POLICY "shifts_select" ON shifts FOR SELECT TO authenticated
  USING (event_id IN (SELECT id FROM events WHERE is_company_member(company_id)));
CREATE POLICY "shifts_insert" ON shifts FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT id FROM events WHERE is_company_member(company_id)));
CREATE POLICY "shifts_update" ON shifts FOR UPDATE TO authenticated
  USING (event_id IN (SELECT id FROM events WHERE is_company_member(company_id)));

-- kb_documents: via kb_folders → company_id
CREATE POLICY "kb_documents_select" ON kb_documents FOR SELECT TO authenticated
  USING (folder_id IN (SELECT id FROM kb_folders WHERE is_company_member(company_id)));
CREATE POLICY "kb_documents_insert" ON kb_documents FOR INSERT TO authenticated
  WITH CHECK (folder_id IN (SELECT id FROM kb_folders WHERE is_company_member(company_id)));

-- chat_members: via chat_channels → company_id
CREATE POLICY "chat_members_select" ON chat_members FOR SELECT TO authenticated
  USING (channel_id IN (SELECT id FROM chat_channels WHERE is_company_member(company_id)));
CREATE POLICY "chat_members_insert" ON chat_members FOR INSERT TO authenticated
  WITH CHECK (user_id = get_my_user_id());

-- chat_messages: via chat_channels → company_id
CREATE POLICY "chat_messages_select" ON chat_messages FOR SELECT TO authenticated
  USING (channel_id IN (SELECT id FROM chat_channels WHERE is_company_member(company_id)));
CREATE POLICY "chat_messages_insert" ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = get_my_user_id());

-- post_comments: via posts → company_id
CREATE POLICY "post_comments_select" ON post_comments FOR SELECT TO authenticated
  USING (post_id IN (SELECT id FROM posts WHERE is_company_member(company_id)));
CREATE POLICY "post_comments_insert" ON post_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = get_my_user_id());

-- post_reactions: via posts → company_id
CREATE POLICY "post_reactions_select" ON post_reactions FOR SELECT TO authenticated
  USING (post_id IN (SELECT id FROM posts WHERE is_company_member(company_id)));
CREATE POLICY "post_reactions_insert" ON post_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = get_my_user_id());

-- ─── Done! ────────────────────────────────────────────────
-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
