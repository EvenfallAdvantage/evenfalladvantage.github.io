-- =============================================================================
-- ROLLBACK for 20261007190500_integrations_config_lockdown.sql
-- Target: OverwatchDB (project nneueuvyeohwnspbwfub) ONLY. Run by hand.
-- Restores the policies and grants as read on 2026-10-07.
-- NOTE: re-opens manager writes and direct verified_at / vault_secret_id edits.
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.integrations_config') IS NULL THEN
    RAISE EXCEPTION 'Wrong database: this rollback is for OverwatchDB (nneueuvyeohwnspbwfub)';
  END IF;
END
$guard$;

DROP TRIGGER IF EXISTS integrations_config_guard ON public.integrations_config;
DROP FUNCTION IF EXISTS public.integrations_config_guard();

DROP POLICY IF EXISTS integrations_config_insert ON public.integrations_config;
CREATE POLICY integrations_config_insert ON public.integrations_config
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(company_id));

DROP POLICY IF EXISTS integrations_config_update ON public.integrations_config;
CREATE POLICY integrations_config_update ON public.integrations_config
  FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id));

GRANT ALL ON public.integrations_config TO anon, authenticated;

COMMIT;
