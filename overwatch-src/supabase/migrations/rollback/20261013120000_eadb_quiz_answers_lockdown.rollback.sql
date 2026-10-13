-- ROLLBACK for eadb/20261013120000_eadb_quiz_answers_lockdown.sql (LEGACY EADB only).
-- Restores the policies/grants read on 2026-10-13. Re-exposes quiz answers.
BEGIN;
DROP POLICY IF EXISTS assessment_questions_admin_select ON public.assessment_questions;
CREATE POLICY "Authenticated users can view questions" ON public.assessment_questions AS PERMISSIVE FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.assessment_questions TO anon;
GRANT SELECT ON public.assessments TO anon, authenticated;
CREATE POLICY "Users can insert own results" ON public.assessment_results AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = student_id));
DROP FUNCTION IF EXISTS public.get_assessment_quiz(uuid);
DROP FUNCTION IF EXISTS public.grade_assessment(uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.admin_get_assessment_questions_json(uuid);
COMMIT;
