-- Fix Student Profiles Table
-- This script adds missing fields and fixes inconsistencies

-- Add missing certification tracking fields
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS certifications_in_progress TEXT[];
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS certifications_completed TEXT[];

-- Standardize profile photo field (use profile_picture_url as the standard)
-- First, copy any data from profile_photo_url to profile_picture_url if it exists
UPDATE student_profiles 
SET profile_picture_url = profile_photo_url 
WHERE profile_photo_url IS NOT NULL 
  AND (profile_picture_url IS NULL OR profile_picture_url = '');

-- Drop the duplicate profile_photo_url column
ALTER TABLE student_profiles DROP COLUMN IF EXISTS profile_photo_url;

-- Ensure all necessary fields exist
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS skills TEXT[];
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS profile_visible BOOLEAN DEFAULT true;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS resume_url TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_student_profiles_visible ON student_profiles(profile_visible);
CREATE INDEX IF NOT EXISTS idx_student_profiles_location ON student_profiles(location);

-- Update existing profiles to set default values if needed
UPDATE student_profiles 
SET profile_visible = true 
WHERE profile_visible IS NULL;

-- Show summary
SELECT 
    COUNT(*) as total_profiles,
    COUNT(profile_picture_url) as profiles_with_photo,
    COUNT(certifications_completed) as profiles_with_certs,
    COUNT(CASE WHEN profile_visible = true THEN 1 END) as visible_profiles
FROM student_profiles;
