-- ─── Time Change Requests ─────────────────────────────
-- Employees can request corrections to their timesheet entries.
-- Managers/owners review and approve/deny from Personnel.

CREATE TABLE IF NOT EXISTS time_change_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id        UUID NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requested_clock_in  TIMESTAMPTZ,
  requested_clock_out TIMESTAMPTZ,
  reason              TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by         UUID REFERENCES users(id),
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE time_change_requests ENABLE ROW LEVEL SECURITY;

-- Employees can see their own requests
CREATE POLICY tcr_select_own ON time_change_requests
  FOR SELECT TO authenticated
  USING (user_id = (SELECT id FROM users WHERE supabase_id = auth.uid()));

-- Admins can see all company requests
CREATE POLICY tcr_select_admin ON time_change_requests
  FOR SELECT TO authenticated
  USING (public.is_company_admin(company_id));

-- Employees can create requests for their own timesheets
CREATE POLICY tcr_insert ON time_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT id FROM users WHERE supabase_id = auth.uid()));

-- Admins can update (approve/deny) requests
CREATE POLICY tcr_update_admin ON time_change_requests
  FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id));

-- ─── Done ─────────────────────────────────────────────
