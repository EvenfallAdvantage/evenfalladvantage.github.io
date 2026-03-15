-- ============================================================
-- OVERWATCH — Add DELETE RLS Policies (Migration)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Helper function: check if user is admin (owner/admin/manager) of a company
CREATE OR REPLACE FUNCTION is_company_admin(comp_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_memberships cm
    JOIN users u ON u.id = cm.user_id
    WHERE u.supabase_id = auth.uid()::text
    AND cm.company_id = comp_id
    AND cm.role IN ('owner', 'admin', 'manager')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── DELETE policies for company-scoped tables ─────────────
-- Admins (owner/admin/manager) can delete records in their company

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
      'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (is_company_admin(company_id))',
      tbl || '_delete', tbl
    );
  END LOOP;
END $$;

-- ─── DELETE policies for tables WITHOUT company_id ─────────

-- Shifts: admins can delete (check via event's company_id)
CREATE POLICY "shifts_delete" ON shifts FOR DELETE TO authenticated
  USING (
    event_id IN (
      SELECT id FROM events WHERE is_company_admin(company_id)
    )
  );

-- KB documents: admins can delete (check via folder's company_id)
CREATE POLICY "kb_documents_delete" ON kb_documents FOR DELETE TO authenticated
  USING (
    folder_id IN (
      SELECT id FROM kb_folders WHERE is_company_admin(company_id)
    )
  );

-- Chat messages: admins can delete any, users can delete own
CREATE POLICY "chat_messages_delete" ON chat_messages FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
    OR channel_id IN (
      SELECT id FROM chat_channels WHERE is_company_admin(company_id)
    )
  );

-- Company memberships: admins can remove members from their company
CREATE POLICY "memberships_delete" ON company_memberships FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM company_memberships cm
      JOIN users u ON u.id = cm.user_id
      WHERE u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin')
    )
  );

-- Time off requests: user can delete own pending requests
CREATE POLICY "time_off_requests_delete" ON time_off_requests FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
  );

-- Form submissions: user can delete own
CREATE POLICY "form_submissions_delete" ON form_submissions FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
  );

-- Quiz attempts: user can delete own
CREATE POLICY "quiz_attempts_delete" ON quiz_attempts FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
  );

-- Certifications: user can delete own
CREATE POLICY "certifications_delete" ON certifications FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
  );

-- Timesheets: user can delete own
CREATE POLICY "timesheets_delete" ON timesheets FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
  );

-- Post comments: user can delete own
CREATE POLICY "post_comments_delete" ON post_comments FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
  );

-- Post reactions: user can delete own
CREATE POLICY "post_reactions_delete" ON post_reactions FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
  );

-- Event interests: user can delete own
CREATE POLICY "event_interests_delete" ON event_interests FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
  );

-- Chat members: admins or self can remove
CREATE POLICY "chat_members_delete" ON chat_members FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
    OR channel_id IN (
      SELECT id FROM chat_channels WHERE is_company_admin(company_id)
    )
  );

-- Course enrollments: user can delete own
CREATE POLICY "course_enrollments_delete" ON course_enrollments FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
  );

-- ============================================================
-- ✅ DELETE policies added for all 28 tables!
-- ============================================================
