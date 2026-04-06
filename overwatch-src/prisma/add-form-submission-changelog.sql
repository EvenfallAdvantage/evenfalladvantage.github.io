-- Add change log and updated_at to form_submissions for audit trail
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS change_log JSONB DEFAULT '[]';
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
