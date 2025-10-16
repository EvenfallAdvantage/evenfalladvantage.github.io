-- Certifications Table Setup
-- PART 1: Run this first in your Supabase SQL Editor

-- Create certifications table
CREATE TABLE IF NOT EXISTS certifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    issuing_organization TEXT NOT NULL,
    issue_date DATE NOT NULL,
    expiry_date DATE,
    credential_id TEXT,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_category CHECK (category IN ('Fire', 'Medical', 'LEO', 'Military', 'Security'))
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_certifications_student_id ON certifications(student_id);
CREATE INDEX IF NOT EXISTS idx_certifications_category ON certifications(category);

-- Enable Row Level Security
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Students can view their own certifications
CREATE POLICY "Students can view own certifications"
    ON certifications FOR SELECT
    USING (auth.uid() = student_id);

-- Students can insert their own certifications
CREATE POLICY "Students can insert own certifications"
    ON certifications FOR INSERT
    WITH CHECK (auth.uid() = student_id);

-- Students can update their own certifications
CREATE POLICY "Students can update own certifications"
    ON certifications FOR UPDATE
    USING (auth.uid() = student_id);

-- Students can delete their own certifications
CREATE POLICY "Students can delete own certifications"
    ON certifications FOR DELETE
    USING (auth.uid() = student_id);

-- Clients can view certifications of students with visible profiles
CREATE POLICY "Clients can view certifications of visible profiles"
    ON certifications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM student_profiles sp
            WHERE sp.student_id = certifications.student_id
            AND sp.profile_visible = true
        )
    );

-- Verify setup
SELECT 'Certifications table created successfully!' as status;

-- ============================================================
-- PART 2: Storage Setup
-- After Part 1 succeeds, create the storage bucket manually in Supabase:
-- 1. Go to Storage in Supabase dashboard
-- 2. Click "New Bucket"
-- 3. Name it "certifications"
-- 4. Make it public
-- 5. Then run the storage policies below:
-- ============================================================

-- Storage policies (run after creating the bucket)
CREATE POLICY "Students can upload their own certification files"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'certifications' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Students can view their own certification files"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'certifications' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Students can delete their own certification files"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'certifications' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Public can view certification files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'certifications');
