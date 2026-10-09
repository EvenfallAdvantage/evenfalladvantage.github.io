-- =============================================================================
-- 20261007190500_integrations_config_lockdown.sql
-- Target: OverwatchDB (project nneueuvyeohwnspbwfub) ONLY.
-- Status: NOT APPLIED (draft, PR "HQ Config E"). Apply LAST, after the data
--         migration 20261007190000 and after the E frontend is live.
-- Rollback: rollback/20261007190500_integrations_config_lockdown.rollback.sql
--
-- Live state read 2026-10-07:
--   integrations_config_select  SELECT TO authenticated USING is_company_admin(company_id)
--   integrations_config_insert  INSERT TO authenticated CHECK is_company_admin(company_id)
--   integrations_config_update  UPDATE TO authenticated USING is_company_admin(company_id) (no WITH CHECK)
--   (no DELETE policy)
--   Table grants: ALL to anon and authenticated (RLS is the only guard).
--   is_company_admin includes MANAGER.
--
-- Problems:
--   * Managers can change any integration and write verified_at /
--     vault_secret_id directly (e.g. mark an unverified sender as verified,
--     or point a row at another company's Vault secret id).
--   * Plaintext secrets can be (re)written into config by any admin client.
--
-- Change:
--   1. INSERT / UPDATE: owner/admin only (is_company_owner_admin), with WITH CHECK.
--      SELECT stays is_company_admin (managers keep read access: the hiring
--      flow and roster email modal read is_active / email status). After the
--      data migration, config holds no secrets, so this read is safe.
--   2. Trigger for non-privileged roles (authenticated/anon):
--        - vault_secret_id cannot be set or changed
--        - verified_at can only be cleared, never set; and it is cleared
--          automatically when delivery_method / from_email / from_name /
--          from_number change (server-enforced re-verification)
--        - config may not contain secret keys (use integration-save-credentials)
--      Edge Functions (service_role) are unaffected.
--   3. Revoke all table privileges from anon (no anon policy exists anyway);
--      authenticated keeps SELECT/INSERT/UPDATE (no DELETE).
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.integrations_config') IS NULL
     OR to_regprocedure('public.is_company_owner_admin(uuid)') IS NULL
     OR to_regprocedure('public.is_company_admin(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Wrong database: this migration is for OverwatchDB (nneueuvyeohwnspbwfub)';
  END IF;
END
$guard$;

DROP POLICY IF EXISTS integrations_config_insert ON public.integrations_config;
CREATE POLICY integrations_config_insert ON public.integrations_config
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_owner_admin(company_id));

DROP POLICY IF EXISTS integrations_config_update ON public.integrations_config;
CREATE POLICY integrations_config_update ON public.integrations_config
  FOR UPDATE TO authenticated
  USING (public.is_company_owner_admin(company_id))
  WITH CHECK (public.is_company_owner_admin(company_id));

CREATE OR REPLACE FUNCTION public.integrations_config_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  secret_keys text[] := ARRAY['api_key','access_token','auth_token','rest_api_key','webhook_secret','secret_key','client_secret','refresh_token','password'];
BEGIN
  -- Edge Functions (service_role) and maintenance roles are trusted.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.config IS NOT NULL AND jsonb_typeof(NEW.config) = 'object' AND NEW.config ?| secret_keys THEN
    RAISE EXCEPTION 'Integration secrets must be saved through integration-save-credentials'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.vault_secret_id := NULL;
    NEW.verified_at := NULL;
    RETURN NEW;
  END IF;

  NEW.vault_secret_id := OLD.vault_secret_id;
  IF NEW.verified_at IS NOT NULL AND NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
    NEW.verified_at := OLD.verified_at;
  END IF;
  IF NEW.delivery_method IS DISTINCT FROM OLD.delivery_method
     OR NEW.from_email IS DISTINCT FROM OLD.from_email
     OR NEW.from_name IS DISTINCT FROM OLD.from_name
     OR NEW.from_number IS DISTINCT FROM OLD.from_number THEN
    NEW.verified_at := NULL;
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS integrations_config_guard ON public.integrations_config;
CREATE TRIGGER integrations_config_guard
  BEFORE INSERT OR UPDATE ON public.integrations_config
  FOR EACH ROW EXECUTE FUNCTION public.integrations_config_guard();

REVOKE ALL ON public.integrations_config FROM anon;
REVOKE DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.integrations_config FROM authenticated;

COMMIT;

-- Verify after apply (run as a test owner, a test manager, in a rolled-back txn):
--   manager: update integrations_config set is_active = false ...      -> 0 rows
--   owner:   update ... set verified_at = now() where provider='email' -> verified_at unchanged
--   owner:   update ... set from_email = 'x@y.z' where provider='email' -> verified_at becomes NULL
--   owner:   update ... set config = '{"api_key":"x"}'                  -> error 42501
--   owner:   update ... set vault_secret_id = gen_random_uuid()         -> unchanged
