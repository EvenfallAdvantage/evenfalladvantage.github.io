-- Rollback for 20261020055651_evidence_integrity. Drops the custody log (its rows are lost).
DROP FUNCTION IF EXISTS public.log_evidence_event(uuid, text, text, text);
DROP TRIGGER IF EXISTS incident_media_custody ON public.incident_media;
DROP TRIGGER IF EXISTS incident_media_hash_lock ON public.incident_media;
DROP FUNCTION IF EXISTS public.incident_media_custody_trg();
DROP TABLE IF EXISTS public.evidence_custody_log;
ALTER TABLE public.incident_media DROP CONSTRAINT IF EXISTS incident_media_capture_source_chk;
ALTER TABLE public.incident_media
  DROP COLUMN IF EXISTS captured_at, DROP COLUMN IF EXISTS capture_lat, DROP COLUMN IF EXISTS capture_lng,
  DROP COLUMN IF EXISTS capture_accuracy_m, DROP COLUMN IF EXISTS capture_source, DROP COLUMN IF EXISTS hash_algo;
