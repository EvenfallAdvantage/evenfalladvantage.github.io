-- Field top-10 #6: evidence integrity + chain of custody.
-- * Capture metadata on incident_media (when/where/how the file was captured).
-- * incident_media.hash becomes write-once (cannot be changed after insert).
-- * evidence_custody_log: append-only log (no UPDATE/DELETE for any client role).
--   'uploaded' and 'deleted' rows are written by triggers; viewed / downloaded /
--   verified / exported rows via log_evidence_event().
-- Safe to re-run. NOT applied by the PR.

ALTER TABLE public.incident_media
  ADD COLUMN IF NOT EXISTS captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS capture_lat double precision,
  ADD COLUMN IF NOT EXISTS capture_lng double precision,
  ADD COLUMN IF NOT EXISTS capture_accuracy_m double precision,
  ADD COLUMN IF NOT EXISTS capture_source text,
  ADD COLUMN IF NOT EXISTS hash_algo text DEFAULT 'SHA-256';

DO $$ BEGIN
  ALTER TABLE public.incident_media ADD CONSTRAINT incident_media_capture_source_chk
    CHECK (capture_source IS NULL OR capture_source IN ('camera','library','file'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.evidence_custody_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL,              -- no FK: the log must outlive a deleted file
  incident_id uuid NOT NULL,
  company_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL CHECK (action IN ('uploaded','viewed','downloaded','verified','verify_failed','exported','deleted')),
  hash text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evidence_custody_log_media_idx ON public.evidence_custody_log (media_id, created_at);
CREATE INDEX IF NOT EXISTS evidence_custody_log_incident_idx ON public.evidence_custody_log (incident_id, created_at);
ALTER TABLE public.evidence_custody_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evidence_custody_select ON public.evidence_custody_log;
CREATE POLICY evidence_custody_select ON public.evidence_custody_log
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));
-- No INSERT/UPDATE/DELETE policies: clients write only through the definer
-- function / triggers below.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.evidence_custody_log FROM anon, authenticated;
GRANT SELECT ON public.evidence_custody_log TO authenticated;

CREATE OR REPLACE FUNCTION public.incident_media_custody_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT company_id INTO v_company FROM public.incidents WHERE id = NEW.incident_id;
    INSERT INTO public.evidence_custody_log(media_id, incident_id, company_id, actor_id, action, hash, note)
    VALUES (NEW.id, NEW.incident_id, v_company, NEW.uploaded_by, 'uploaded', NEW.hash,
            concat_ws(' · ', NEW.file_name, NEW.capture_source, CASE WHEN NEW.captured_at IS NOT NULL THEN 'captured ' || NEW.captured_at::text END));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.hash IS NOT NULL AND NEW.hash IS DISTINCT FROM OLD.hash THEN
      RAISE EXCEPTION 'incident_media.hash is write-once' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  ELSE
    SELECT company_id INTO v_company FROM public.incidents WHERE id = OLD.incident_id;
    IF v_company IS NOT NULL THEN
      INSERT INTO public.evidence_custody_log(media_id, incident_id, company_id, actor_id, action, hash, note)
      VALUES (OLD.id, OLD.incident_id, v_company, public.get_my_user_id(), 'deleted', OLD.hash, OLD.file_name);
    END IF;
    RETURN OLD;
  END IF;
END $$;

DROP TRIGGER IF EXISTS incident_media_custody ON public.incident_media;
CREATE TRIGGER incident_media_custody AFTER INSERT OR DELETE ON public.incident_media
  FOR EACH ROW EXECUTE FUNCTION public.incident_media_custody_trg();
DROP TRIGGER IF EXISTS incident_media_hash_lock ON public.incident_media;
CREATE TRIGGER incident_media_hash_lock BEFORE UPDATE ON public.incident_media
  FOR EACH ROW EXECUTE FUNCTION public.incident_media_custody_trg();

CREATE OR REPLACE FUNCTION public.log_evidence_event(p_media_id uuid, p_action text, p_hash text DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inc uuid; v_company uuid; v_stored text; v_id uuid; v_action text := p_action;
BEGIN
  IF p_action NOT IN ('viewed','downloaded','verified','exported') THEN
    RAISE EXCEPTION 'action not allowed' USING ERRCODE = '22023';
  END IF;
  SELECT m.incident_id, i.company_id, m.hash INTO v_inc, v_company, v_stored
    FROM public.incident_media m JOIN public.incidents i ON i.id = m.incident_id WHERE m.id = p_media_id;
  IF v_inc IS NULL OR NOT public.is_company_member(v_company) THEN
    RAISE EXCEPTION 'not found' USING ERRCODE = '42501';
  END IF;
  -- A 'verified' claim is checked against the stored hash server-side.
  IF p_action = 'verified' AND (p_hash IS NULL OR v_stored IS NULL OR lower(p_hash) <> lower(v_stored)) THEN
    v_action := 'verify_failed';
  END IF;
  INSERT INTO public.evidence_custody_log(media_id, incident_id, company_id, actor_id, action, hash, note)
  VALUES (p_media_id, v_inc, v_company, public.get_my_user_id(), v_action, p_hash, left(p_note, 500))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.log_evidence_event(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_evidence_event(uuid, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.incident_media_custody_trg() FROM PUBLIC, anon, authenticated;
