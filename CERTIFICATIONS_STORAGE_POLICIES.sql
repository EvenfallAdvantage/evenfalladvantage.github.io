-- Storage Policies for Certifications Bucket
-- Run this in Supabase SQL Editor AFTER creating the bucket

-- First, remove any existing policies
DROP POLICY IF EXISTS "Students can upload their own certification files" ON storage.objects;
DROP POLICY IF EXISTS "Students can view their own certification files" ON storage.objects;
DROP POLICY IF EXISTS "Students can delete their own certification files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view certification files" ON storage.objects;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Allow authenticated uploads to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'certifications' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own files
CREATE POLICY "Allow users to update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'certifications' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
CREATE POLICY "Allow users to delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'certifications' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all certification files
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'certifications');

SELECT 'Storage policies created successfully!' as status;
