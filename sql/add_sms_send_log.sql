-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SMS SEND LOG                                                     ║
-- ║                                                                   ║
-- ║  Every outbound message from the sms-send / sms-reply-to-reporter ║
-- ║  Edge Functions lands here. Used by the HQ Config → SMS page to   ║
-- ║  show the recent-sends list, and by the Security Center for       ║
-- ║  audit.                                                           ║
-- ║                                                                   ║
-- ║  Optional submission_id back-link is for messages sent in reply   ║
-- ║  to a public_report_submissions row (Phase 4.7 reporter thread).  ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS sms_send_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('twilio', 'platform')),
  to_number       TEXT NOT NULL,
  from_number     TEXT NOT NULL,
  body            TEXT NOT NULL,
  purpose         TEXT NOT NULL CHECK (purpose IN (
    'reporter_reply', 'broadcast', 'shift_reminder', 'test_send', 'other'
  )),
  status          TEXT NOT NULL CHECK (status IN ('sent', 'rejected', 'failed')),
  provider_id     TEXT,
  error_message   TEXT,
  submission_id   UUID REFERENCES public_report_submissions(id) ON DELETE SET NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sms_send_log_company_sent_at
  ON sms_send_log(company_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_send_log_to_number
  ON sms_send_log(to_number);
CREATE INDEX IF NOT EXISTS idx_sms_send_log_submission
  ON sms_send_log(submission_id) WHERE submission_id IS NOT NULL;

ALTER TABLE sms_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sms_send_log_select ON sms_send_log;
CREATE POLICY sms_send_log_select ON sms_send_log
  FOR SELECT TO authenticated
  USING (public.is_company_admin(company_id));

-- Writes from Edge Functions only (service-role).

COMMENT ON TABLE sms_send_log IS
  'Per-message log of outbound SMS dispatched by the sms-send / sms-reply-to-reporter Edge Functions. Visible to admins/managers/owners of the owning company.';
