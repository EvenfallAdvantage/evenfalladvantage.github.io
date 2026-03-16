-- ============================================================
-- Add catalog columns to courses table
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add missing catalog columns
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS duration_hours NUMERIC(5,1) DEFAULT 1;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS difficulty_level TEXT DEFAULT 'beginner';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_name TEXT;

-- Index for catalog queries
CREATE INDEX IF NOT EXISTS idx_courses_active ON courses(is_active, display_order);

-- ============================================================
-- ✅ Done! Courses will now show in the catalog.
-- ============================================================
