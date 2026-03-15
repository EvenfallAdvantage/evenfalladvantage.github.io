-- Allow students to view client info (for messaging)
-- Students need to see company names of clients they're messaging with

CREATE POLICY "Allow authenticated users to view clients" ON clients
    FOR SELECT 
    TO authenticated
    USING (true);
