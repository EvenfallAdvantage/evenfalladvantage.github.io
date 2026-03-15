-- Notification RLS policies
-- Run in Supabase SQL Editor

CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));

CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));

CREATE POLICY "notifications_delete" ON notifications FOR DELETE TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));
