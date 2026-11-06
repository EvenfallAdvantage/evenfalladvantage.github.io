-- =============================================================================
-- 20261106180000_airtable_oauth_applicant_dedupe.sql
-- Target: OverwatchDB (project nneueuvyeohwnspbwfub) ONLY.
-- Status: NOT APPLIED. Do not run this from an agent. Apply with the Airtable
--         OAuth deploy, after review.
-- Rollback: rollback/20261106180000_airtable_oauth_applicant_dedupe.rollback.sql
--
-- Does not read, move, or delete Vault secrets or integrations_config rows.
-- Legacy Airtable personal-access-token rows stay until a company owner
-- retires them by hand after OAuth connect, test, and a reviewed import.
--
-- 1. applicants.custom_fields (already used by the app) stores
--    airtable_record_id. A partial unique index makes a company unable to
--    insert the same Airtable record twice, including under a race.
-- 2. integration_connections.settings for provider airtable may contain only
--    base_id, base_name, table_id, and table_name. Tokens cannot be written
--    into the column the browser is allowed to read.
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.applicants') IS NULL
     OR to_regclass('public.integration_connections') IS NULL THEN
    RAISE EXCEPTION 'Wrong database: this migration is for OverwatchDB (nneueuvyeohwnspbwfub)';
  END IF;
END
$guard$;

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS applicants_company_airtable_record_uidx
  ON public.applicants (company_id, (custom_fields->>'airtable_record_id'))
  WHERE coalesce(custom_fields->>'airtable_record_id', '') <> '';

CREATE OR REPLACE FUNCTION public.integration_airtable_settings_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  allowed text[] := ARRAY['base_id', 'base_name', 'table_id', 'table_name'];
  k text;
  v text;
  clean jsonb := '{}'::jsonb;
BEGIN
  IF NEW.provider IS DISTINCT FROM 'airtable' THEN
    RETURN NEW;
  END IF;
  IF NEW.settings IS NULL OR jsonb_typeof(NEW.settings) <> 'object' THEN
    NEW.settings := '{}'::jsonb;
    RETURN NEW;
  END IF;
  FOR k, v IN
    SELECT key, value FROM jsonb_each_text(NEW.settings)
  LOOP
    IF NOT (k = ANY (allowed)) OR v = '' OR char_length(v) > 200 THEN
      CONTINUE;
    END IF;
    IF k = 'base_id' AND v !~ '^app[A-Za-z0-9]{14}$' THEN
      RAISE EXCEPTION 'invalid airtable base_id' USING ERRCODE = '22023';
    END IF;
    IF k = 'table_id' AND v !~ '^tbl[A-Za-z0-9]{14}$' THEN
      RAISE EXCEPTION 'invalid airtable table_id' USING ERRCODE = '22023';
    END IF;
    clean := clean || jsonb_build_object(k, v);
  END LOOP;
  NEW.settings := clean;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS integration_airtable_settings_guard ON public.integration_connections;
CREATE TRIGGER integration_airtable_settings_guard
  BEFORE INSERT OR UPDATE OF settings, provider ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.integration_airtable_settings_guard();

COMMIT;
