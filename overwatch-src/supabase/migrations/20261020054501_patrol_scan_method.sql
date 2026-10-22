-- Field top-10 #7: record HOW a checkpoint was logged (QR / NFC / deep link / manual)
-- plus GPS accuracy and distance from the checkpoint's pinned position.
-- Existing columns scan_lat / scan_lng / gps_verified are reused. NOT applied by the PR.
ALTER TABLE public.patrol_logs
  ADD COLUMN IF NOT EXISTS scan_method text,
  ADD COLUMN IF NOT EXISTS scan_accuracy_m double precision,
  ADD COLUMN IF NOT EXISTS scan_distance_m integer;
DO $$ BEGIN
  ALTER TABLE public.patrol_logs ADD CONSTRAINT patrol_logs_scan_method_chk
    CHECK (scan_method IS NULL OR scan_method IN ('qr','nfc','link','manual'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Codes are looked up by value when a tag is scanned.
CREATE INDEX IF NOT EXISTS checkpoints_company_qr_idx ON public.checkpoints (company_id, upper(qr_code));
