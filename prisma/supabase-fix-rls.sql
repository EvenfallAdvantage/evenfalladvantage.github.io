-- ============================================================
-- OVERWATCH — RLS Fix (run after the first script errored)
-- Tables + indexes already created. This adds the remaining policies.
-- ============================================================

-- Drop the failed policies if any partially created
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
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_update', tbl);
  END LOOP;
END $$;

-- Recreate the helper function
CREATE OR REPLACE FUNCTION is_company_member(comp_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_memberships cm
    JOIN users u ON u.id = cm.user_id
    WHERE u.supabase_id = auth.uid()::text
    AND cm.company_id = comp_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Company-scoped tables (all have company_id column)
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

-- Tables WITHOUT company_id — user-scoped
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

-- Parent-referenced tables
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

-- ✅ All RLS policies created successfully!
