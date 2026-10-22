-- Rollback for 20261021083138_saved_signatures.
-- Drops the snapshot column (signatures on past Shift Notes are lost) and the
-- bucket policies. The bucket and its files are left in place on purpose; to
-- remove them, empty the bucket via the Storage API, then:
--   DELETE FROM storage.buckets WHERE id = 'signatures';
DROP POLICY IF EXISTS signatures_owner_select ON storage.objects;
DROP POLICY IF EXISTS signatures_owner_insert ON storage.objects;
DROP POLICY IF EXISTS signatures_owner_update ON storage.objects;
DROP POLICY IF EXISTS signatures_owner_delete ON storage.objects;
ALTER TABLE public.dar_signoffs DROP COLUMN IF EXISTS signature_png;
