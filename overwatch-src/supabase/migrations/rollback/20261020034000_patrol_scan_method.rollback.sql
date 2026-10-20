DROP INDEX IF EXISTS public.checkpoints_company_qr_idx;
ALTER TABLE public.patrol_logs DROP CONSTRAINT IF EXISTS patrol_logs_scan_method_chk;
ALTER TABLE public.patrol_logs DROP COLUMN IF EXISTS scan_method, DROP COLUMN IF EXISTS scan_accuracy_m, DROP COLUMN IF EXISTS scan_distance_m;
