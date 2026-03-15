-- ============================================================================
-- Overwatch Security Audit Logging (NIST 800-171 §3.3)
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type    TEXT NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id    UUID,
  ip_address    TEXT,
  user_agent    TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,
  outcome       TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'blocked')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_outcome ON audit_logs(outcome);

-- Composite index for common dashboard queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created
  ON audit_logs(company_id, created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: users can insert their own audit logs
CREATE POLICY "Users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: admins can read audit logs for their company
CREATE POLICY "Admins can read company audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Auto-cleanup: delete audit logs older than 90 days (retention policy)
-- Run this as a cron job or Supabase scheduled function
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_logs WHERE created_at < now() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
