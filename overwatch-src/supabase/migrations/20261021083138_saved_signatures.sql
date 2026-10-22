-- Saved signatures for Shift Notes (dar_signoffs). NOT APPLIED: needs owner approval.
--
-- 1. Private storage bucket `signatures`. One file per officer at
--    {auth uid}/signature.png. Only the owner can read/write/delete it.
--    Nobody else reads the profile copy: supervisors see the snapshot below.
-- 2. dar_signoffs.signature_png: a per-sign-off snapshot (PNG data URL) taken
--    when the officer signs, so replacing or deleting the profile signature
--    never changes past Shift Notes. Visibility follows the existing
--    dar_signoffs RLS (the officer, plus same-company admins/managers via
--    is_company_admin). Rows stay immutable for officers (no UPDATE policy).
-- No new public table, so the grant rule is re-asserted on dar_signoffs only.

-- 1. Bucket (private, PNG only, 256 KB cap)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('signatures', 'signatures', false, 262144, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 262144, allowed_mime_types = ARRAY['image/png'];

DROP POLICY IF EXISTS signatures_owner_select ON storage.objects;
DROP POLICY IF EXISTS signatures_owner_insert ON storage.objects;
DROP POLICY IF EXISTS signatures_owner_update ON storage.objects;
DROP POLICY IF EXISTS signatures_owner_delete ON storage.objects;

CREATE POLICY signatures_owner_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'signatures' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY signatures_owner_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signatures' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY signatures_owner_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'signatures' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'signatures' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY signatures_owner_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'signatures' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- 2. Snapshot column (nullable; old rows and signature-less sign-offs stay NULL)
ALTER TABLE public.dar_signoffs
  ADD COLUMN IF NOT EXISTS signature_png text
  CHECK (signature_png IS NULL OR (signature_png LIKE 'data:image/png;base64,%' AND char_length(signature_png) <= 350000));

-- Grant rule (house): SELECT to anon; S/I/U/D to authenticated + service_role;
-- never TRUNCATE/REFERENCES/TRIGGER for anon/authenticated. RLS stays on.
ALTER TABLE public.dar_signoffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.dar_signoffs FROM anon;
GRANT SELECT ON TABLE public.dar_signoffs TO anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.dar_signoffs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dar_signoffs TO authenticated, service_role;
