-- Create state_laws table for managing state-specific security guard requirements
-- This allows admins to update state laws without modifying code

-- Drop table if exists (for clean reinstall)
-- DROP TABLE IF EXISTS state_laws CASCADE;

-- Create state_laws table
CREATE TABLE IF NOT EXISTS state_laws (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_code VARCHAR(2) NOT NULL UNIQUE,
    state_name VARCHAR(100) NOT NULL,
    licensing TEXT NOT NULL,
    training_hours TEXT NOT NULL,
    min_age VARCHAR(50) NOT NULL,
    use_of_force TEXT NOT NULL,
    citizens_arrest TEXT NOT NULL,
    weapons TEXT NOT NULL,
    regulatory_agency TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on state_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_state_laws_code ON state_laws(state_code);

-- Add RLS (Row Level Security) policies
ALTER TABLE state_laws ENABLE ROW LEVEL SECURITY;

-- Allow public read access (students need to read state laws)
CREATE POLICY "Allow public read access to state laws"
    ON state_laws
    FOR SELECT
    TO public
    USING (true);

-- Allow authenticated users to read (redundant but explicit)
CREATE POLICY "Allow authenticated read access to state laws"
    ON state_laws
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert/update/delete
-- Note: In production, you should restrict this to admin users only
-- For now, any authenticated user can manage state laws through the admin interface
CREATE POLICY "Allow authenticated insert access to state laws"
    ON state_laws
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update access to state laws"
    ON state_laws
    FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated delete access to state laws"
    ON state_laws
    FOR DELETE
    TO authenticated
    USING (true);

-- Add comment
COMMENT ON TABLE state_laws IS 'State-specific security guard laws and requirements. Used to generate state-specific assessment questions for Module 7.';

-- Verify table creation
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'state_laws'
ORDER BY ordinal_position;
