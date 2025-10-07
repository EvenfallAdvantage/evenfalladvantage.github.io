-- Client Portal Database Setup

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Clients can view own profile" ON clients;
DROP POLICY IF EXISTS "Clients can insert own profile" ON clients;
DROP POLICY IF EXISTS "Clients can update own profile" ON clients;
DROP POLICY IF EXISTS "Clients can view own jobs" ON job_postings;
DROP POLICY IF EXISTS "Clients can create jobs" ON job_postings;
DROP POLICY IF EXISTS "Clients can update own jobs" ON job_postings;
DROP POLICY IF EXISTS "Clients can delete own jobs" ON job_postings;
DROP POLICY IF EXISTS "Public can view active jobs" ON job_postings;

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    industry TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    description TEXT,
    website TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create job_postings table
CREATE TABLE IF NOT EXISTS job_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    employment_type TEXT NOT NULL,
    salary_range TEXT,
    description TEXT NOT NULL,
    required_certifications TEXT[],
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;

-- Policies for clients
CREATE POLICY "Clients can view own profile" ON clients
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Clients can insert own profile" ON clients
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Clients can update own profile" ON clients
    FOR UPDATE USING (auth.uid() = id);

-- Policies for job_postings
CREATE POLICY "Clients can view own jobs" ON job_postings
    FOR SELECT USING (auth.uid() = client_id);

CREATE POLICY "Clients can create jobs" ON job_postings
    FOR INSERT WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can update own jobs" ON job_postings
    FOR UPDATE USING (auth.uid() = client_id);

CREATE POLICY "Clients can delete own jobs" ON job_postings
    FOR DELETE USING (auth.uid() = client_id);

-- Public can view active jobs
CREATE POLICY "Public can view active jobs" ON job_postings
    FOR SELECT USING (status = 'active');
