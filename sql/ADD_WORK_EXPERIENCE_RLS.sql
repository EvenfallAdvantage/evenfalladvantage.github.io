-- Allow clients to view student work experience

CREATE POLICY "Allow authenticated users to view work experience" ON work_experience
    FOR SELECT 
    TO authenticated
    USING (true);
