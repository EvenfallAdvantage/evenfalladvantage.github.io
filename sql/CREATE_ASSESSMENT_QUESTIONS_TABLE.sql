-- Create assessment_questions table to store AI-generated questions
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Create assessment_questions table
-- ============================================

CREATE TABLE IF NOT EXISTS assessment_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE NOT NULL,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
    explanation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(assessment_id, question_number)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment_id ON assessment_questions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_question_number ON assessment_questions(question_number);

-- ============================================
-- 2. Enable RLS
-- ============================================

ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view questions
CREATE POLICY "Authenticated users can view questions"
ON assessment_questions FOR SELECT
TO authenticated
USING (true);

-- Allow admins to manage questions
CREATE POLICY "Admins can insert questions"
ON assessment_questions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can update questions"
ON assessment_questions FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can delete questions"
ON assessment_questions FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

-- ============================================
-- 3. Create trigger for updated_at
-- ============================================

CREATE TRIGGER update_assessment_questions_updated_at
    BEFORE UPDATE ON assessment_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. Verify setup
-- ============================================

SELECT 'Assessment questions table created successfully!' as status;

-- Check table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'assessment_questions'
ORDER BY ordinal_position;
