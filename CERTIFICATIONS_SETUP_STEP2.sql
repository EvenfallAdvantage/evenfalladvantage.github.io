-- Step 2: Add RLS Policies
-- Run this AFTER Step 1 succeeds

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

SELECT 'Policies created!' as status;
