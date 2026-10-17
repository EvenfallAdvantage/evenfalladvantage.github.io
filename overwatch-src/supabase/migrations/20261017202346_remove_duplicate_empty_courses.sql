-- EADB retirement phase 6: remove the 3 empty Overwatch course shells that duplicate
-- copied EADB courses (same titles). Applied 2026-10-17 13:23 PT as version 20261017202346 (MCP apply_migration;
-- applied body = this file without the BEGIN/COMMIT lines; removed all 3 shells; EADB prices kept by decision).
--
--   6d1bfb20-5abe-4e53-a2c3-d06262fe5570  Unarmed Guard Core            (keep c4757f12…, from EADB)
--   81e8c6ba-74a3-4cd7-811d-273e641c54f4  Advanced Surveillance & …     (keep 774f7003…, from EADB)
--   f1d4872f-4ae1-4dc6-bda9-a33b8db1b62a  Systema Scout                 (keep ccaeb538…, from EADB)
--
-- They are not literally empty: each has a description, price 50.00 and duration. The EADB copies
-- have the same descriptions and durations, but prices differ (Advanced Surveillance 75.00, Systema
-- Scout 40.00, Unarmed Guard Core 50.00), and the shell for Unarmed Guard Core has is_required = true.
-- Confirm the EADB prices are the right ones before applying. The shells have no modules,
-- enrolments, module links, payments, classes or default-course
-- references. The DELETE re-checks that at apply time and skips any row that gained a reference;
-- the final check fails the migration if a duplicate is left behind for that reason.
-- Rollback: migrations/rollback/20261017202346_remove_duplicate_empty_courses.rollback.sql
BEGIN;

CREATE TEMP TABLE _dup_courses ON COMMIT DROP AS
SELECT c.* FROM public.courses c
WHERE c.id IN ('6d1bfb20-5abe-4e53-a2c3-d06262fe5570', '81e8c6ba-74a3-4cd7-811d-273e641c54f4', 'f1d4872f-4ae1-4dc6-bda9-a33b8db1b62a')
  AND c.company_id = '0f03bc15-aa8d-4bd3-956f-90bdd7904091'
  AND c.eadb_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.course_enrollments e WHERE e.course_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.course_modules m WHERE m.course_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.payment_transactions p WHERE p.course_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.training_classes k WHERE k.course_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.training_modules t WHERE t.default_course_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.course_completion_requirements r WHERE r.course_id = c.id)
  -- an EADB copy with the same title must exist, so nothing unique is lost
  AND EXISTS (SELECT 1 FROM public.courses k WHERE k.company_id = c.company_id AND k.eadb_id IS NOT NULL AND k.title = c.title);

DELETE FROM public.courses c USING _dup_courses d WHERE c.id = d.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.courses WHERE id IN ('6d1bfb20-5abe-4e53-a2c3-d06262fe5570',
      '81e8c6ba-74a3-4cd7-811d-273e641c54f4', 'f1d4872f-4ae1-4dc6-bda9-a33b8db1b62a')) THEN
    RAISE EXCEPTION 'a duplicate course is now referenced; review it by hand before deleting';
  END IF;
END $$;

COMMIT;
