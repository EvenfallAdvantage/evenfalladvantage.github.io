-- Field top-10 #8: structured witness / party statements with on-device signature.
-- One row per person. A statement is locked once signed (or marked declined):
-- the text, signature and hashes can't change afterwards. NOT applied by the PR.

CREATE TABLE IF NOT EXISTS public.incident_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  person_role text NOT NULL DEFAULT 'witness'
    CHECK (person_role IN ('witness','victim','suspect','reporting_party','complainant','employee','other')),
  full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 1 AND 200),
  phone text CHECK (phone IS NULL OR length(phone) <= 40),
  email text CHECK (email IS NULL OR length(email) <= 200),
  address text CHECK (address IS NULL OR length(address) <= 500),
  statement text CHECK (statement IS NULL OR length(statement) <= 20000),
  declined boolean NOT NULL DEFAULT false,
  taken_by uuid NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now(),
  taken_lat double precision,
  taken_lng double precision,
  signature_png text CHECK (signature_png IS NULL OR (signature_png LIKE 'data:image/png;base64,%' AND length(signature_png) <= 300000)),
  statement_sha256 text,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS incident_statements_incident_idx ON public.incident_statements (incident_id, taken_at);

ALTER TABLE public.incident_statements ENABLE ROW LEVEL SECURITY;

-- Company must match the incident, and the taker must be the caller.
CREATE OR REPLACE FUNCTION public.incident_statements_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.incidents WHERE id = NEW.incident_id;
  IF v_company IS NULL OR NEW.company_id IS DISTINCT FROM v_company THEN
    RAISE EXCEPTION 'company does not match incident' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.signed_at IS NOT NULL OR OLD.declined THEN
      RAISE EXCEPTION 'statement is locked' USING ERRCODE = '42501';
    END IF;
    NEW.taken_by := OLD.taken_by; NEW.incident_id := OLD.incident_id; NEW.created_at := OLD.created_at;
  END IF;
  IF NEW.signature_png IS NOT NULL AND NEW.signed_at IS NULL THEN NEW.signed_at := now(); END IF;
  IF NEW.signed_at IS NOT NULL AND NEW.signature_png IS NULL THEN
    RAISE EXCEPTION 'signed_at requires a signature' USING ERRCODE = '23514';
  END IF;
  IF NEW.signed_at IS NOT NULL OR NEW.declined THEN
    NEW.signed_at := CASE WHEN NEW.signed_at IS NOT NULL THEN now() END;  -- server time, not client
    -- Fingerprint of exactly what was signed / recorded, computed server-side.
    NEW.statement_sha256 := encode(sha256(convert_to(concat_ws(E'\n', NEW.full_name, NEW.person_role, coalesce(NEW.statement, ''), NEW.declined::text), 'UTF8')), 'hex');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.incident_statements_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS incident_statements_guard ON public.incident_statements;
CREATE TRIGGER incident_statements_guard BEFORE INSERT OR UPDATE ON public.incident_statements
  FOR EACH ROW EXECUTE FUNCTION public.incident_statements_guard();

DROP POLICY IF EXISTS incident_statements_select ON public.incident_statements;
CREATE POLICY incident_statements_select ON public.incident_statements FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
DROP POLICY IF EXISTS incident_statements_insert ON public.incident_statements;
CREATE POLICY incident_statements_insert ON public.incident_statements FOR INSERT TO authenticated
  WITH CHECK (taken_by = public.get_my_user_id() AND public.is_company_member(company_id));
DROP POLICY IF EXISTS incident_statements_update ON public.incident_statements;
CREATE POLICY incident_statements_update ON public.incident_statements FOR UPDATE TO authenticated
  USING (taken_by = public.get_my_user_id() AND signed_at IS NULL AND NOT declined)
  WITH CHECK (taken_by = public.get_my_user_id());
DROP POLICY IF EXISTS incident_statements_delete ON public.incident_statements;
CREATE POLICY incident_statements_delete ON public.incident_statements FOR DELETE TO authenticated
  USING (public.is_company_admin(company_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_statements TO authenticated;
