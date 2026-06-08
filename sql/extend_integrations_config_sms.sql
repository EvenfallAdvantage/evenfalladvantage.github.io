-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  EXTEND integrations_config FOR SMS SENDING                       ║
-- ║                                                                   ║
-- ║  Adds columns the new sms-send / sms-reply-to-reporter Edge       ║
-- ║  Functions need to route SMS through a per-company Twilio account ║
-- ║  or the platform fallback.                                        ║
-- ║                                                                   ║
-- ║  Schema rules:                                                    ║
-- ║   - integrations_config.provider = 'sms' is the kind.             ║
-- ║   - delivery_method is the actual transport: twilio | platform.   ║
-- ║   - vault_secret_id points at vault.secrets that holds the Twilio ║
-- ║     creds (Account SID + Auth Token + optional from number) as a  ║
-- ║     JSON blob.                                                    ║
-- ║   - verified_at gates whether the row is usable (no verified_at   ║
-- ║     ⇒ platform fallback). The new sms-test-send Edge Function     ║
-- ║     stamps verified_at after a successful real send.              ║
-- ║                                                                   ║
-- ║  We reuse the existing integrations_config columns added by the   ║
-- ║  email migration: verified_at, vault_secret_id, test_sent_to.     ║
-- ║  New here: from_number.                                           ║
-- ║                                                                   ║
-- ║  Idempotent — safe to re-run.                                     ║
-- ╚══════════════════════════════════════════════════════════════════╝

ALTER TABLE integrations_config
  ADD COLUMN IF NOT EXISTS from_number TEXT;

COMMENT ON COLUMN integrations_config.from_number IS
  'For provider=sms rows: the sender E.164 number or messaging-service SID.';

-- Widen the delivery_method check constraint to accept 'twilio'.
DO $$ BEGIN
  ALTER TABLE integrations_config
    DROP CONSTRAINT IF EXISTS integrations_config_delivery_method_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE integrations_config
    ADD CONSTRAINT integrations_config_delivery_method_check
    CHECK (delivery_method IS NULL
           OR delivery_method IN ('smtp', 'resend', 'platform', 'twilio'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
