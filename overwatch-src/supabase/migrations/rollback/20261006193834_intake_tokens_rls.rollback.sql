-- =============================================================================
-- ROLLBACK for 20261006193834_intake_tokens_rls.sql
-- Target: OverwatchDB (project nneueuvyeohwnspbwfub) ONLY. Run by hand.
-- Restores the live policies as read from pg_policies on 2026-10-06.
-- NOTE: this re-opens public read/update of every intake row (lead PII).
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.client_intake_tokens') IS NULL OR to_regclass('public.company_memberships') IS NULL THEN
    RAISE EXCEPTION 'Wrong database: this rollback is for OverwatchDB (nneueuvyeohwnspbwfub)';
  END IF;
END
$guard$;

DROP POLICY IF EXISTS intake_tokens_manager_select ON public.client_intake_tokens;
DROP POLICY IF EXISTS intake_tokens_manager_insert ON public.client_intake_tokens;
DROP POLICY IF EXISTS intake_tokens_manager_update ON public.client_intake_tokens;
DROP POLICY IF EXISTS intake_tokens_manager_delete ON public.client_intake_tokens;

CREATE POLICY "Public read by token" ON public.client_intake_tokens
  FOR SELECT TO public USING (true);
CREATE POLICY "Public update by token" ON public.client_intake_tokens
  FOR UPDATE TO public USING (status = ANY (ARRAY['active'::text, 'submitted'::text]));
CREATE POLICY "Authenticated insert" ON public.client_intake_tokens
  FOR INSERT TO public WITH CHECK (( SELECT ( SELECT auth.uid() AS uid) AS uid) IS NOT NULL);
CREATE POLICY "Authenticated delete" ON public.client_intake_tokens
  FOR DELETE TO public USING (( SELECT ( SELECT auth.uid() AS uid) AS uid) IS NOT NULL);

GRANT ALL ON public.client_intake_tokens TO anon;

DROP FUNCTION IF EXISTS public.get_intake_by_token(text);
DROP FUNCTION IF EXISTS public.submit_intake_by_token(text, text, text, jsonb);

COMMIT;
