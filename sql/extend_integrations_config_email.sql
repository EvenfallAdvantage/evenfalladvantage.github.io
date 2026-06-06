-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  EXTEND integrations_config FOR EMAIL SENDING                     ║
-- ║                                                                   ║
-- ║  Adds columns the new email-send / roster-invite / roster-bulk-   ║
-- ║  email Edge Functions need to route mail through per-company      ║
-- ║  SMTP, Resend, or the platform fallback.                          ║
-- ║                                                                   ║
-- ║  Schema rules:                                                    ║
-- ║   - integrations_config.provider stays = 'email' (the kind).      ║
-- ║   - delivery_method (NEW) is the actual transport: smtp | resend  ║
-- ║     | platform. Legacy rows have NULL → factory falls back to     ║
-- ║     platform until the admin re-configures via the new UI.        ║
-- ║   - vault_secret_id (NEW) points at vault.secrets that holds the  ║
-- ║     SMTP creds or Resend api_key as a JSON blob.                  ║
-- ║   - verified_at gates whether the row is usable (no verified_at   ║
-- ║     ⇒ platform fallback). The new email-test-send Edge Function   ║
-- ║     stamps verified_at after a successful real TCP/AUTH/send.     ║
-- ║                                                                   ║
-- ║  Idempotent — safe to re-run.                                     ║
-- ╚══════════════════════════════════════════════════════════════════╝

ALTER TABLE integrations_config
  ADD COLUMN IF NOT EXISTS delivery_method TEXT,
  ADD COLUMN IF NOT EXISTS from_email      TEXT,
  ADD COLUMN IF NOT EXISTS from_name       TEXT,
  ADD COLUMN IF NOT EXISTS reply_to        TEXT,
  ADD COLUMN IF NOT EXISTS verified_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS test_sent_to    TEXT,
  ADD COLUMN IF NOT EXISTS vault_secret_id UUID;

-- delivery_method must be one of the supported transports when set.
DO $$ BEGIN
  ALTER TABLE integrations_config
    ADD CONSTRAINT integrations_config_delivery_method_check
    CHECK (delivery_method IS NULL
           OR delivery_method IN ('smtp', 'resend', 'platform'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN integrations_config.delivery_method IS
  'For provider=email rows: the underlying transport. smtp | resend | platform.';
COMMENT ON COLUMN integrations_config.vault_secret_id IS
  'Points at vault.secrets with JSON payload — SmtpConfig or ResendConfig.';
COMMENT ON COLUMN integrations_config.verified_at IS
  'Stamped by email-test-send Edge Function after a successful real send. NULL ⇒ row not usable; falls back to platform delivery.';
