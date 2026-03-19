-- ============================================================================
-- Overwatch Certifications Storage Bucket
-- Run in: Overwatch Supabase Dashboard → SQL Editor → New Query
-- ============================================================================

-- Create the certifications storage bucket (public read, 10MB max)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certifications',
  'certifications',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

-- Policy: authenticated users can upload their own cert documents
DO $$ BEGIN
  CREATE POLICY "Users can upload own certs"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'certifications' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: authenticated users can update/overwrite their own cert documents
DO $$ BEGIN
  CREATE POLICY "Users can update own certs"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'certifications' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: authenticated users can delete their own cert documents
DO $$ BEGIN
  CREATE POLICY "Users can delete own certs"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'certifications' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: anyone can view cert documents (public bucket)
DO $$ BEGIN
  CREATE POLICY "Public cert access"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'certifications');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
