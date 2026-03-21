-- ============================================================
-- Fix: Allow company admins to view all company timesheets
-- The existing timesheets_select policy only allows user_id = auth.uid()
-- This adds an admin policy so owners/admins/managers can see
-- timesheets for all members in their company.
-- ============================================================

CREATE POLICY "timesheets_admin_select" ON timesheets
  FOR SELECT TO authenticated
  USING (
    user_id IN (
      SELECT cm.user_id
      FROM company_memberships cm
      WHERE cm.status = 'active'
        AND cm.company_id IN (
          SELECT cm2.company_id
          FROM company_memberships cm2
          JOIN users u ON u.id = cm2.user_id
          WHERE u.supabase_id = auth.uid()::text
            AND cm2.status = 'active'
            AND cm2.role IN ('owner', 'admin', 'manager')
        )
    )
  );

-- Also allow admins to UPDATE (approve) company members' timesheets
CREATE POLICY "timesheets_admin_update" ON timesheets
  FOR UPDATE TO authenticated
  USING (
    user_id IN (
      SELECT cm.user_id
      FROM company_memberships cm
      WHERE cm.status = 'active'
        AND cm.company_id IN (
          SELECT cm2.company_id
          FROM company_memberships cm2
          JOIN users u ON u.id = cm2.user_id
          WHERE u.supabase_id = auth.uid()::text
            AND cm2.status = 'active'
            AND cm2.role IN ('owner', 'admin', 'manager')
        )
    )
  );
