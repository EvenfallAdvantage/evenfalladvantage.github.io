-- =============================================================================
-- ROLLBACK for eadb/20261006210000_eadb_assessments_admin_write.sql
-- Target: LEGACY EADB (project vaagvairvwmgyzsmymhs) ONLY.
-- Removes the three admin write policies on public.assessments, returning to
-- the 2026-10-06 state (signed-in admins can't write assessments again).
-- Doesn't touch the anon policies (owned by 20261006120500).
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.module_slides') IS NULL
     OR to_regclass('public.administrators') IS NULL
     OR to_regclass('public.company_memberships') IS NOT NULL THEN
    RAISE EXCEPTION 'Wrong database: this rollback is for the legacy EADB (vaagvairvwmgyzsmymhs)';
  END IF;
END
$guard$;

DROP POLICY IF EXISTS "Admins can insert assessments" ON public.assessments;
DROP POLICY IF EXISTS "Admins can update assessments" ON public.assessments;
DROP POLICY IF EXISTS "Admins can delete assessments" ON public.assessments;

COMMIT;
