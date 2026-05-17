-- ============================================================================
-- Overwatch Avatar Storage Bucket
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Create the avatars storage bucket (public, 5MB max)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Policy: authenticated users can upload their own avatars
DO $$ BEGIN
  CREATE POLICY "Users can upload own avatars"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: authenticated users can update/overwrite their own avatars
DO $$ BEGIN
  CREATE POLICY "Users can update own avatars"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: authenticated users can delete their own avatars
DO $$ BEGIN
  CREATE POLICY "Users can delete own avatars"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Note: NO public SELECT policy on the avatars bucket. Public URLs
-- (returned by storage.from('avatars').getPublicUrl(path)) work via
-- Supabase's CDN endpoint when bucket.public = true, which BYPASSES
-- RLS entirely. A "FOR SELECT TO public" policy on storage.objects
-- would only add the ability for any client to LIST every file in
-- the bucket via /storage/v1/object/list/avatars — which is a data
-- enumeration vector we don't want. If you need an authenticated
-- listing for an admin UI, add a SCOPED policy (e.g. only members
-- of the avatar owner's company) instead of a public one.

-- ============================================================================
-- ✅ Done! Avatars bucket created with RLS policies.
-- ============================================================================
