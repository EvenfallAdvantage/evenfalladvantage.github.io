-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  EMAIL SEND LOG                                                   ║
-- ║                                                                   ║
-- ║  Every outbound message from the email-send Edge Function lands   ║
-- ║  here. Used by the HQ Config → Email Sending page to show the     ║
-- ║  recent-sends list, and by the Security Center for audit.         ║
-- ║                                                                   ║
-- ║  No retention policy set yet; recommended to add a daily cron     ║
-- ║  truncating rows older than 90 days once volume warrants.         ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS email_send_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('smtp', 'resend', 'platform')),
  to_email        TEXT NOT NULL,
  from_email      TEXT NOT NULL,
  subject         TEXT NOT NULL,
  purpose         TEXT NOT NULL CHECK (purpose IN (
    'invitation', 'broadcast', 'shift_reminder',
    'time_change', 'welcome', 'test_send', 'other'
  )),
  status          TEXT NOT NULL CHECK (status IN ('sent', 'rejected', 'bounced', 'failed')),
  provider_id     TEXT,
  error_message   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_email_send_log_company_sent_at
  ON email_send_log(company_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_to_email
  ON email_send_log(to_email);

ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;

-- Admins/managers/owners can view their own company's email send log.
DROP POLICY IF EXISTS email_send_log_select ON email_send_log;
CREATE POLICY email_send_log_select ON email_send_log
  FOR SELECT TO authenticated
  USING (public.is_company_admin(company_id));

-- Writes from Edge Functions only (service-role).

COMMENT ON TABLE email_send_log IS
  'Per-message log of outbound mail dispatched by the email-send Edge Function. '
  'Visible to admins/managers/owners of the owning company.';
