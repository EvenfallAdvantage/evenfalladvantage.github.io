-- ============================================================================
-- Overwatch Security Audit Logging (NIST 800-171 §3.3)
-- Run this in Supabase SQL Editor
--
-- NOTE: audit_logs table already exists from supabase-setup.sql
-- This migration ADDS the security columns needed by the Security Center.
-- ============================================================================

-- Add missing security columns to the existing audit_logs table
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Backfill event_type from existing 'action' column where null
UPDATE audit_logs SET event_type = action WHERE event_type IS NULL AND action IS NOT NULL;

-- Indexes for security queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_outcome ON audit_logs(outcome);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Policy: users can insert their own audit logs (skip if exists)
DO $$ BEGIN
  CREATE POLICY "Users can insert audit logs"
    ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-cleanup: delete audit logs older than 90 days
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_logs WHERE created_at < now() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- ✅ Done! Security columns added to audit_logs.
-- ============================================================================
