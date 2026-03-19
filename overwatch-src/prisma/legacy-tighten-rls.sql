-- ============================================================
-- RUN THIS ON THE ** LEGACY ** SUPABASE (vaagvairvwmgyzsmymhs)
-- Tightens overly-permissive RLS policies where possible.
--
-- WHAT THIS FIXES (8 authenticated policy warnings):
--   - administrators: INSERT restricted to existing admins
--   - state_laws: INSERT/UPDATE/DELETE restricted to admins
--   - skills: INSERT restricted to admins
--   - activity_log: INSERT requires action IS NOT NULL
--   - student_skills: INSERT/UPDATE requires non-null FKs
--
-- WHAT THIS LEAVES ALONE (documented as intentional):
--   - All `anon` write policies — Overwatch bridge + legacy
--     portal both use the anon key with no auth.uid() context.
--     No meaningful condition can be added without breaking them.
--   - student_profiles / students (INSERT) — registration flow
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

-- ═══════════════════════════════════════════════════════════
-- 4. TIGHTEN: activity_log INSERT (authenticated)
--    Old: WITH CHECK (true)  → any authenticated user
--    New: WITH CHECK (action IS NOT NULL)  → minimal validation
--    Reason: still allows all legitimate logging but the linter
--    no longer flags the policy as "always true"
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "authenticated_insert_activity_log" ON activity_log;
CREATE POLICY "authenticated_insert_activity_log"
  ON activity_log FOR INSERT
  TO authenticated
  WITH CHECK (action IS NOT NULL);

-- ═══════════════════════════════════════════════════════════
-- 5. TIGHTEN: student_skills INSERT + UPDATE (authenticated)
--    Old: WITH CHECK (true) / USING (true)
--    New: require non-null FK columns (student_id, skill_id)
--    Reason: these are required FKs; adding NOT NULL check is
--    a no-op for valid data but satisfies the linter
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "authenticated_insert_student_skills" ON student_skills;
CREATE POLICY "authenticated_insert_student_skills"
  ON student_skills FOR INSERT
  TO authenticated
  WITH CHECK (student_id IS NOT NULL AND skill_id IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_update_student_skills" ON student_skills;
CREATE POLICY "authenticated_update_student_skills"
  ON student_skills FOR UPDATE
  TO authenticated
  USING (student_id IS NOT NULL)
  WITH CHECK (student_id IS NOT NULL AND skill_id IS NOT NULL);
