-- ROLLBACK for 20261106180000_airtable_oauth_applicant_dedupe.sql
-- Drops the Airtable settings guard and the applicant dedupe index.
-- Does not delete applicants or integration_connections rows.
-- custom_fields is left in place (the column predates this migration).

BEGIN;

DROP TRIGGER IF EXISTS integration_airtable_settings_guard ON public.integration_connections;
DROP FUNCTION IF EXISTS public.integration_airtable_settings_guard();
DROP INDEX IF EXISTS public.applicants_company_airtable_record_uidx;

COMMIT;
