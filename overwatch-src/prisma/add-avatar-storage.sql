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

-- Policy: anyone can view avatars (public bucket)
DO $$ BEGIN
  CREATE POLICY "Public avatar access"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- ✅ Done! Avatars bucket created with RLS policies.
-- ============================================================================
