-- Fix storyboard RLS policies
-- The original policies used `user_id = auth.uid()` which doesn't work because
-- company_memberships.user_id references users.id (internal UUID), not auth.uid().
-- The correct approach uses the is_company_member() helper function which joins
-- through users.supabase_id = auth.uid()::text.

DROP POLICY IF EXISTS "Company members can view storyboards" ON storyboards;
DROP POLICY IF EXISTS "Company members can create storyboards" ON storyboards;
DROP POLICY IF EXISTS "Company members can update storyboards" ON storyboards;
DROP POLICY IF EXISTS "Company members can delete storyboards" ON storyboards;

CREATE POLICY "Company members can view storyboards"
  ON storyboards FOR SELECT TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Company members can create storyboards"
  ON storyboards FOR INSERT TO authenticated
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "Company members can update storyboards"
  ON storyboards FOR UPDATE TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Company members can delete storyboards"
  ON storyboards FOR DELETE TO authenticated
  USING (is_company_member(company_id));
