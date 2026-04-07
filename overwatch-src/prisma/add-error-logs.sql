-- Error logging table for built-in error tracking
-- Replaces external services like Sentry

CREATE TABLE IF NOT EXISTS error_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  level       TEXT NOT NULL DEFAULT 'error',  -- error, warning, info
  message     TEXT NOT NULL,
  stack       TEXT,
  url         TEXT,
  user_agent  TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_company ON error_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level);

-- RLS: only admins/owners can read error logs
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company admins can view error logs"
  ON error_logs FOR SELECT TO authenticated
  USING (is_company_member(company_id));

-- Authenticated users can log their own errors (or anonymous with null user_id)
CREATE POLICY "Authenticated users can log errors"
  ON error_logs FOR INSERT TO authenticated
  WITH CHECK (
    user_id IS NULL
    OR user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
  );

-- Auto-cleanup: delete logs older than 30 days
CREATE OR REPLACE FUNCTION cleanup_old_error_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM error_logs WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql
SET search_path = '';
