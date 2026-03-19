-- ============================================================
-- RUN THIS ON THE ** LEGACY ** SUPABASE (vaagvairvwmgyzsmymhs)
-- Tightens overly-permissive RLS policies where possible.
--
-- WHAT THIS FIXES (5 warnings):
--   - administrators: INSERT restricted to existing admins
--   - state_laws: INSERT/UPDATE/DELETE restricted to admins
--   - skills: INSERT restricted to admins
--
-- WHAT THIS LEAVES ALONE (documented as intentional):
--   - All `anon` write policies — Overwatch bridge + legacy
--     portal both use the anon key with no auth.uid() context.
--     No meaningful condition can be added without breaking them.
--   - activity_log (authenticated INSERT) — general logging
--   - student_profiles / students (INSERT) — registration flow
--   - student_skills (authenticated INSERT/UPDATE) — course
--     completion flow where student earns skills
--
-- ALSO: If function_search_path_mutable warnings still show,
--   run legacy-linter-cleanup.sql (all 3 functions are fixed
--   there). The linter may need a re-run to clear cache.
--
-- ALSO: "Leaked Password Protection" is a DASHBOARD setting:
--   Auth → Settings → Enable "Leaked password protection"
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- 1. TIGHTEN: administrators INSERT (authenticated)
--    Old: WITH CHECK (true)  → anyone authenticated can add admins
--    New: WITH CHECK (is_admin(auth.uid()))  → only existing admins
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admins can create new admins" ON administrators;
CREATE POLICY "Admins can create new admins"
  ON administrators FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

-- ═══════════════════════════════════════════════════════════
-- 2. TIGHTEN: state_laws INSERT/UPDATE/DELETE (authenticated)
--    Old: all WITH CHECK (true) / USING (true)
--    New: restricted to admins only
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Allow authenticated insert access to state laws" ON state_laws;
CREATE POLICY "Allow authenticated insert access to state laws"
  ON state_laws FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Allow authenticated update access to state laws" ON state_laws;
CREATE POLICY "Allow authenticated update access to state laws"
  ON state_laws FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Allow authenticated delete access to state laws" ON state_laws;
CREATE POLICY "Allow authenticated delete access to state laws"
  ON state_laws FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- ═══════════════════════════════════════════════════════════
-- 3. TIGHTEN: skills INSERT (authenticated)
--    Old: WITH CHECK (true)  → anyone can create skills
--    New: WITH CHECK (is_admin(auth.uid()))  → admins only
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "authenticated_insert_skills" ON skills;
CREATE POLICY "authenticated_insert_skills"
  ON skills FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));
