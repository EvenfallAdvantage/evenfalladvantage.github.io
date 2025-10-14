-- Add updated_at column to training_modules table
-- Run this in Supabase SQL Editor

-- Add updated_at column if it doesn't exist
ALTER TABLE training_modules 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records to have current timestamp
UPDATE training_modules 
SET updated_at = NOW() 
WHERE updated_at IS NULL;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'training_modules' 
AND column_name IN ('created_at', 'updated_at');

SELECT 'Timestamp column added successfully!' as status;
