-- ============================================================================
-- Overwatch Company Logos Storage Bucket
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================================

-- Create the company-logos storage bucket (public, 5MB max, images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

-- Policy: authenticated users can upload logos (folder = company_id)
DO $$ BEGIN
  CREATE POLICY "Users can upload company logos"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'company-logos'
      AND EXISTS (
        SELECT 1 FROM public.company_memberships cm
        JOIN public.users u ON u.id = cm.user_id
        WHERE u.supabase_id = auth.uid()::text
          AND cm.company_id::text = (storage.foldername(name))[1]
          AND cm.role IN ('owner', 'admin')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: authenticated users can update/overwrite logos
DO $$ BEGIN
  CREATE POLICY "Users can update company logos"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'company-logos'
      AND EXISTS (
        SELECT 1 FROM public.company_memberships cm
        JOIN public.users u ON u.id = cm.user_id
        WHERE u.supabase_id = auth.uid()::text
          AND cm.company_id::text = (storage.foldername(name))[1]
          AND cm.role IN ('owner', 'admin')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: authenticated users can delete logos
DO $$ BEGIN
  CREATE POLICY "Users can delete company logos"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'company-logos'
      AND EXISTS (
        SELECT 1 FROM public.company_memberships cm
        JOIN public.users u ON u.id = cm.user_id
        WHERE u.supabase_id = auth.uid()::text
          AND cm.company_id::text = (storage.foldername(name))[1]
          AND cm.role IN ('owner', 'admin')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: anyone can view logos (public bucket)
DO $$ BEGIN
  CREATE POLICY "Public company logo access"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'company-logos');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- ✅ Done! company-logos bucket created with RLS policies.
-- Only owners/admins of a company can upload to that company's folder.
-- ============================================================================
