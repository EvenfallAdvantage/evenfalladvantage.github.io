-- Rollback for 20261106223000_airtable_roster_reconcile.sql.
-- Drops the two functions only. Memberships, users, and Airtable links already
-- written by a sync are not restored.

BEGIN;

DROP FUNCTION IF EXISTS public.apply_airtable_roster_sync(uuid, text, text, jsonb);
DROP FUNCTION IF EXISTS public.airtable_roster_email_owners(text[]);

NOTIFY pgrst, 'reload schema';

COMMIT;
