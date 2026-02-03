-- =====================================================
-- CREATE SCENARIO RESULTS TABLE
-- =====================================================
-- Stores student performance on practice scenarios
-- (e.g., de-escalation scenarios)
-- =====================================================

-- Create scenario_results table
CREATE TABLE IF NOT EXISTS scenario_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    scenario_id TEXT NOT NULL,
    steps INTEGER NOT NULL,
    success BOOLEAN DEFAULT true,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_scenario_results_student_id ON scenario_results(student_id);
CREATE INDEX IF NOT EXISTS idx_scenario_results_scenario_id ON scenario_results(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_results_student_scenario ON scenario_results(student_id, scenario_id);

-- Enable RLS
ALTER TABLE scenario_results ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Students can view their own scenario results" ON scenario_results;
DROP POLICY IF EXISTS "Students can insert their own scenario results" ON scenario_results;
DROP POLICY IF EXISTS "Students can update their own scenario results" ON scenario_results;

-- Create RLS policies
CREATE POLICY "Students can view their own scenario results"
ON scenario_results FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own scenario results"
ON scenario_results FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own scenario results"
ON scenario_results FOR UPDATE
TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

-- Verify table was created
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'scenario_results'
ORDER BY ordinal_position;

-- Verify RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'scenario_results';
