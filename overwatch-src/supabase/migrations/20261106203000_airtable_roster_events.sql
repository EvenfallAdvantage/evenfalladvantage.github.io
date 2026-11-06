-- =============================================================================
-- 20261106203000_airtable_roster_events.sql
-- Target: OverwatchDB (project nneueuvyeohwnspbwfub) ONLY.
-- Status: NOT APPLIED. Do not run this from an agent or CI. Apply by hand
--         with the Airtable roster/events deploy, after review.
-- Rollback: rollback/20261106203000_airtable_roster_events.rollback.sql
--
-- Does not read or write Vault, tokens, or company roster/event rows.
-- Applicant dedupe from 20261106180000 is left in place.
--
-- 1. integration_connections.settings may also store roster_* and events_*
--    base/table ids. A partial save keeps the other purpose's keys, so saving
--    Events cannot wipe Employees. Tokens are still rejected.
-- 2. airtable_field_mappings stores the confirmed source field for each
--    Overwatch destination, keyed by company + purpose + base + table.
--    Role, status, pay, and approval are not destinations. No secrets.
-- 3. events gain a nullable Airtable record link. Roster links reuse
--    employee_external_ids (provider airtable). Owners and admins are not
--    granted, demoted, or removed by these columns.
--
-- Authorization reads company_memberships through is_company_owner_admin
-- (live role, not a JWT metadata claim). UPDATE policies are paired with
-- SELECT policies. New functions are trigger functions, not security definer,
-- and are not granted to anon/authenticated.
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.integration_connections') IS NULL
     OR to_regclass('public.employee_external_ids') IS NULL
     OR to_regclass('public.company_memberships') IS NULL
     OR to_regclass('public.events') IS NULL
     OR to_regclass('public.companies') IS NULL
     OR to_regprocedure('public.is_company_owner_admin(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Wrong database: this migration is for OverwatchDB (nneueuvyeohwnspbwfub)';
  END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public.integration_airtable_settings_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  allowed text[] := ARRAY[
    'base_id', 'base_name', 'table_id', 'table_name',
    'roster_base_id', 'roster_base_name', 'roster_table_id', 'roster_table_name',
    'events_base_id', 'events_base_name', 'events_table_id', 'events_table_name'
  ];
  k text;
  v text;
  clean jsonb := '{}'::jsonb;
BEGIN
  IF NEW.provider IS DISTINCT FROM 'airtable' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.settings IS NOT NULL AND jsonb_typeof(OLD.settings) = 'object' THEN
    FOR k, v IN SELECT key, value FROM jsonb_each_text(OLD.settings)
    LOOP
      IF k = ANY (allowed) AND v <> '' AND char_length(v) <= 200 THEN
        clean := clean || jsonb_build_object(k, v);
      END IF;
    END LOOP;
  END IF;
  IF NEW.settings IS NULL OR jsonb_typeof(NEW.settings) <> 'object' THEN
    NEW.settings := clean;
    RETURN NEW;
  END IF;
  FOR k, v IN SELECT key, value FROM jsonb_each_text(NEW.settings)
  LOOP
    IF NOT (k = ANY (allowed)) OR v = '' OR char_length(v) > 200 THEN
      CONTINUE;
    END IF;
    IF k LIKE '%base_id' AND v !~ '^app[A-Za-z0-9]{14}$' THEN
      RAISE EXCEPTION 'invalid airtable base_id' USING ERRCODE = '22023';
    END IF;
    IF k LIKE '%table_id' AND v !~ '^tbl[A-Za-z0-9]{14}$' THEN
      RAISE EXCEPTION 'invalid airtable table_id' USING ERRCODE = '22023';
    END IF;
    IF k ~* 'token|secret|password|key' THEN
      CONTINUE;
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

CREATE TABLE IF NOT EXISTS public.airtable_field_mappings (
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  purpose      text NOT NULL CHECK (purpose IN ('roster', 'events')),
  base_id      text NOT NULL CHECK (base_id ~ '^app[A-Za-z0-9]{14}$'),
  table_id     text NOT NULL CHECK (table_id ~ '^tbl[A-Za-z0-9]{14}$'),
  mappings     jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(mappings) = 'object' AND octet_length(mappings::text) < 20000),
  confirmed_at timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, purpose, base_id, table_id)
);

COMMENT ON TABLE public.airtable_field_mappings IS
  'Confirmed Airtable source fields for roster or events. No tokens. Role and status are not destinations.';

CREATE OR REPLACE FUNCTION public.airtable_field_mappings_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  allowed text[];
  k text;
  entry jsonb;
  fid text;
  fname text;
  ftype text;
  extra text;
BEGIN
  IF NEW.purpose = 'roster' THEN
    allowed := ARRAY['first_name', 'last_name', 'email', 'phone', 'title'];
  ELSIF NEW.purpose = 'events' THEN
    allowed := ARRAY['title', 'start', 'end', 'location', 'notes'];
  ELSE
    RAISE EXCEPTION 'invalid airtable mapping purpose' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(NEW.mappings) <> 'object' THEN
    RAISE EXCEPTION 'airtable mappings must be an object' USING ERRCODE = '22023';
  END IF;
  FOR k IN SELECT jsonb_object_keys(NEW.mappings)
  LOOP
    IF NOT (k = ANY (allowed)) THEN
      RAISE EXCEPTION 'Airtable cannot map destination %', k USING ERRCODE = '22023';
    END IF;
    entry := NEW.mappings -> k;
    IF jsonb_typeof(entry) <> 'object' THEN
      RAISE EXCEPTION 'airtable mapping % must be an object', k USING ERRCODE = '22023';
    END IF;
    SELECT key INTO extra
      FROM jsonb_object_keys(entry) AS key
      WHERE key NOT IN ('field_id', 'name', 'type')
      LIMIT 1;
    IF extra IS NOT NULL THEN
      RAISE EXCEPTION 'airtable mapping % cannot store %', k, extra USING ERRCODE = '22023';
    END IF;
    fid := entry->>'field_id';
    fname := entry->>'name';
    ftype := entry->>'type';
    IF fid IS NULL OR fid !~ '^fld[A-Za-z0-9]{14}$' THEN
      RAISE EXCEPTION 'invalid airtable field id' USING ERRCODE = '22023';
    END IF;
    IF fname IS NULL OR char_length(btrim(fname)) = 0 OR char_length(fname) > 200 THEN
      RAISE EXCEPTION 'invalid airtable field name' USING ERRCODE = '22023';
    END IF;
    IF ftype IS NULL OR ftype !~ '^[A-Za-z][A-Za-z0-9]{0,39}$' THEN
      RAISE EXCEPTION 'invalid airtable field type' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  NEW.updated_at := now();
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS airtable_field_mappings_guard ON public.airtable_field_mappings;
CREATE TRIGGER airtable_field_mappings_guard
  BEFORE INSERT OR UPDATE ON public.airtable_field_mappings
  FOR EACH ROW EXECUTE FUNCTION public.airtable_field_mappings_guard();

REVOKE ALL ON FUNCTION public.airtable_field_mappings_guard() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.airtable_field_mappings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.airtable_field_mappings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.airtable_field_mappings TO authenticated;
GRANT ALL ON public.airtable_field_mappings TO service_role;

DROP POLICY IF EXISTS airtable_field_mappings_select ON public.airtable_field_mappings;
CREATE POLICY airtable_field_mappings_select ON public.airtable_field_mappings
  FOR SELECT TO authenticated
  USING (public.is_company_owner_admin(company_id));

DROP POLICY IF EXISTS airtable_field_mappings_insert ON public.airtable_field_mappings;
CREATE POLICY airtable_field_mappings_insert ON public.airtable_field_mappings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_owner_admin(company_id));

DROP POLICY IF EXISTS airtable_field_mappings_update ON public.airtable_field_mappings;
CREATE POLICY airtable_field_mappings_update ON public.airtable_field_mappings
  FOR UPDATE TO authenticated
  USING (public.is_company_owner_admin(company_id))
  WITH CHECK (public.is_company_owner_admin(company_id));

DROP POLICY IF EXISTS airtable_field_mappings_delete ON public.airtable_field_mappings;
CREATE POLICY airtable_field_mappings_delete ON public.airtable_field_mappings
  FOR DELETE TO authenticated
  USING (public.is_company_owner_admin(company_id));

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS airtable_record_id text,
  ADD COLUMN IF NOT EXISTS airtable_base_id text,
  ADD COLUMN IF NOT EXISTS airtable_table_id text,
  ADD COLUMN IF NOT EXISTS airtable_sync_hash text;

DO $checks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_airtable_record_fmt') THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_airtable_record_fmt
      CHECK (airtable_record_id IS NULL OR airtable_record_id ~ '^rec[A-Za-z0-9]{14}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_airtable_base_fmt') THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_airtable_base_fmt
      CHECK (airtable_base_id IS NULL OR airtable_base_id ~ '^app[A-Za-z0-9]{14}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_airtable_table_fmt') THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_airtable_table_fmt
      CHECK (airtable_table_id IS NULL OR airtable_table_id ~ '^tbl[A-Za-z0-9]{14}$');
  END IF;
END
$checks$;

CREATE UNIQUE INDEX IF NOT EXISTS events_company_airtable_record_uidx
  ON public.events (company_id, airtable_record_id)
  WHERE coalesce(airtable_record_id, '') <> '';

COMMENT ON COLUMN public.events.airtable_record_id IS
  'Airtable record id for an event created by explicit sync. Null means the operation is manually owned.';

CREATE OR REPLACE FUNCTION public.guard_airtable_event_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.airtable_record_id := NULL;
      NEW.airtable_base_id := NULL;
      NEW.airtable_table_id := NULL;
      NEW.airtable_sync_hash := NULL;
      RETURN NEW;
    END IF;
    IF NEW.airtable_record_id IS DISTINCT FROM OLD.airtable_record_id
       OR NEW.airtable_base_id IS DISTINCT FROM OLD.airtable_base_id
       OR NEW.airtable_table_id IS DISTINCT FROM OLD.airtable_table_id
       OR NEW.airtable_sync_hash IS DISTINCT FROM OLD.airtable_sync_hash THEN
      RAISE EXCEPTION 'Airtable event links can only be changed by the sync service'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS guard_airtable_event_link ON public.events;
CREATE TRIGGER guard_airtable_event_link
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.guard_airtable_event_link();

REVOKE ALL ON FUNCTION public.guard_airtable_event_link() FROM PUBLIC, anon, authenticated;

COMMIT;
