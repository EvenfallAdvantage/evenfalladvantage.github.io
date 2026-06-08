-- Fix team_members RLS policies: company_memberships.user_id stores the
-- internal user ID (users.id), not the Supabase auth UID.
-- Must join through users.supabase_id to resolve auth.uid().

DROP POLICY IF EXISTS team_members_select ON team_members;
CREATE POLICY team_members_select ON team_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      JOIN company_memberships cm ON cm.company_id = t.company_id
      JOIN users u ON u.id = cm.user_id
      WHERE t.id = team_members.team_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner','admin','manager')
    )
  );

DROP POLICY IF EXISTS team_members_insert ON team_members;
CREATE POLICY team_members_insert ON team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t
      JOIN company_memberships cm ON cm.company_id = t.company_id
      JOIN users u ON u.id = cm.user_id
      WHERE t.id = team_members.team_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner','admin','manager')
    )
  );

DROP POLICY IF EXISTS team_members_delete ON team_members;
CREATE POLICY team_members_delete ON team_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      JOIN company_memberships cm ON cm.company_id = t.company_id
      JOIN users u ON u.id = cm.user_id
      WHERE t.id = team_members.team_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner','admin','manager')
    )
  );
