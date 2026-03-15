-- Add questions_json column to assessments table if it doesn't exist
-- Run this in Supabase SQL Editor

-- First, check what columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'assessments'
ORDER BY ordinal_position;

-- Add the questions_json column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'assessments' 
        AND column_name = 'questions_json'
    ) THEN
        ALTER TABLE assessments 
        ADD COLUMN questions_json jsonb DEFAULT '[]'::jsonb;
        
        RAISE NOTICE 'Added questions_json column to assessments table';
    ELSE
        RAISE NOTICE 'questions_json column already exists';
    END IF;
END $$;

-- Also add updated_at if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'assessments' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE assessments 
        ADD COLUMN updated_at timestamp with time zone DEFAULT now();
        
        RAISE NOTICE 'Added updated_at column to assessments table';
    ELSE
        RAISE NOTICE 'updated_at column already exists';
    END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'assessments'
ORDER BY ordinal_position;
