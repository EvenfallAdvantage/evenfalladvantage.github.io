-- Course Management Database Setup
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Update training_modules table structure
-- ============================================

-- Add additional fields to training_modules if they don't exist
ALTER TABLE training_modules 
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'fa-book',
ADD COLUMN IF NOT EXISTS estimated_time TEXT,
ADD COLUMN IF NOT EXISTS difficulty_level TEXT CHECK (difficulty_level IN ('Essential', 'Critical', 'Advanced')),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- ============================================
-- 2. Create module_slides table
-- ============================================

CREATE TABLE IF NOT EXISTS module_slides (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module_id UUID REFERENCES training_modules(id) ON DELETE CASCADE NOT NULL,
    slide_number INTEGER NOT NULL,
    slide_type TEXT NOT NULL CHECK (slide_type IN ('text', 'image', 'video', 'mixed')),
    title TEXT,
    content TEXT,
    image_url TEXT,
    video_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(module_id, slide_number)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_module_slides_module_id ON module_slides(module_id);
CREATE INDEX IF NOT EXISTS idx_module_slides_slide_number ON module_slides(slide_number);

-- ============================================
-- 3. Enable RLS
-- ============================================

ALTER TABLE module_slides ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view slides
CREATE POLICY "Everyone can view slides"
ON module_slides FOR SELECT
TO authenticated
USING (true);

-- Allow admins to manage slides
CREATE POLICY "Admins can manage slides"
ON module_slides FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

-- ============================================
-- 4. Create storage bucket for course media
-- ============================================

-- Note: You'll need to manually create the 'course-media' bucket in Supabase Storage
-- Then run these policies:

-- Storage policies for course media
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-media', 'course-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload course media
CREATE POLICY "Admins can upload course media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'course-media' 
    AND EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

-- Allow admins to update course media
CREATE POLICY "Admins can update course media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'course-media'
    AND EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

-- Allow admins to delete course media
CREATE POLICY "Admins can delete course media"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'course-media'
    AND EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

-- Allow everyone to view course media
CREATE POLICY "Everyone can view course media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'course-media');

-- ============================================
-- 5. Create trigger for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_module_slides_updated_at
    BEFORE UPDATE ON module_slides
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_training_modules_updated_at
    BEFORE UPDATE ON training_modules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. Verify setup
-- ============================================

SELECT 'Course management tables created successfully!' as status;

-- Check tables
SELECT 
    'training_modules' as table_name,
    COUNT(*) as record_count
FROM training_modules
UNION ALL
SELECT 
    'module_slides' as table_name,
    COUNT(*) as record_count
FROM module_slides;
