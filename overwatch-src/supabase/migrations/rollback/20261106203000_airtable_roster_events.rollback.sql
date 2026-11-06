-- ROLLBACK for 20261106203000_airtable_roster_events.sql
-- Restores the applicant-only Airtable settings guard.
-- Does not delete roster people, events, employee_external_ids, or applicant rows.
-- Drops confirmed field mappings and the Airtable columns on events.

BEGIN;

DROP TRIGGER IF EXISTS guard_airtable_event_link ON public.events;
DROP FUNCTION IF EXISTS public.guard_airtable_event_link();

DROP INDEX IF EXISTS public.events_company_airtable_record_uidx;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_airtable_record_fmt;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_airtable_base_fmt;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_airtable_table_fmt;
ALTER TABLE public.events DROP COLUMN IF EXISTS airtable_sync_hash;
ALTER TABLE public.events DROP COLUMN IF EXISTS airtable_table_id;
ALTER TABLE public.events DROP COLUMN IF EXISTS airtable_base_id;
ALTER TABLE public.events DROP COLUMN IF EXISTS airtable_record_id;

DROP TRIGGER IF EXISTS airtable_field_mappings_guard ON public.airtable_field_mappings;
DROP FUNCTION IF EXISTS public.airtable_field_mappings_guard();
DROP TABLE IF EXISTS public.airtable_field_mappings;

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

COMMIT;
