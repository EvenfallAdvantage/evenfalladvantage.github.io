-- NEXT_TEN #4: officer sign-off on the Daily Activity Report at clock-out.
-- NOT APPLIED. Needs owner approval.
--
-- One row per timesheet. The officer writes a short shift summary and signs
-- (typed name + timestamp); a JSON snapshot of the generated DAR is stored so
-- later edits to logs don't change what was signed. Officers insert their own
-- (for their own timesheet); they and company admins can read. Rows are
-- immutable for officers (no UPDATE/DELETE policy); admins may delete.

CREATE TABLE IF NOT EXISTS public.dar_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  timesheet_id uuid NOT NULL UNIQUE REFERENCES public.timesheets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  summary text NOT NULL DEFAULT '' CHECK (char_length(summary) <= 4000),
  signed_name text NOT NULL CHECK (char_length(signed_name) BETWEEN 2 AND 120),
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  signed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dar_signoffs_company_idx ON public.dar_signoffs (company_id, signed_at DESC);

ALTER TABLE public.dar_signoffs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.dar_signoffs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dar_signoffs TO authenticated, service_role;

CREATE POLICY dar_signoffs_select ON public.dar_signoffs
  FOR SELECT TO authenticated
  USING (user_id = (SELECT public.get_my_user_id()) OR public.is_company_admin(company_id));

CREATE POLICY dar_signoffs_insert ON public.dar_signoffs
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT public.get_my_user_id())
    AND public.is_company_member(company_id)
    AND EXISTS (
      SELECT 1 FROM public.timesheets t
      WHERE t.id = timesheet_id AND t.user_id = (SELECT public.get_my_user_id())
        AND t.clock_out IS NOT NULL
        AND (t.company_id IS NULL OR t.company_id = dar_signoffs.company_id)
    )
  );

CREATE POLICY dar_signoffs_delete ON public.dar_signoffs
  FOR DELETE TO authenticated
  USING (public.is_company_admin(company_id));
