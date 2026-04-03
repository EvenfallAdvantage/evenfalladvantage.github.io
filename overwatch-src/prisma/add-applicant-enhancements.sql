-- Applicant Pipeline Enhancements
-- Adds structured education, work history, and document upload support

-- 1. Add structured data columns to applicants table
ALTER TABLE applicants
  ADD COLUMN IF NOT EXISTS education JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS work_history JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]';

-- education: [{ institution, degree, startYear, endYear }]
-- work_history: [{ employer, title, startDate, endDate, description }]
-- documents: [{ name, type, fileUrl }]

-- 2. Add education and work_history to company_memberships for post-hire carry-over
ALTER TABLE company_memberships
  ADD COLUMN IF NOT EXISTS education JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS work_history JSONB DEFAULT '[]';

-- 3. Create applicant-documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'applicant-documents',
  'applicant-documents',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: anyone can upload (public application form), authenticated can manage
CREATE POLICY "Anyone can upload applicant documents"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'applicant-documents');

CREATE POLICY "Anyone can view applicant documents"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'applicant-documents');

CREATE POLICY "Authenticated users can delete applicant documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'applicant-documents');

-- Update the anon insert RLS policy to include new JSONB columns
-- (They default to '[]' so no policy change needed for NOT NULL checks)
