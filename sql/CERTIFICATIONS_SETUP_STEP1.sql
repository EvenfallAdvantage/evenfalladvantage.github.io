-- Step 1: Create the certifications table ONLY
-- Run this first

-- Drop existing table if it exists (to start fresh)
DROP TABLE IF EXISTS certifications CASCADE;

-- Create the table
CREATE TABLE certifications (
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_certifications_student_id ON certifications (student_id);
CREATE INDEX IF NOT EXISTS idx_certifications_category ON certifications (category);

-- Enable RLS
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;

SELECT 'Table created!' as status;
