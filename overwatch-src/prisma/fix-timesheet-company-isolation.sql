-- Fix timesheet company isolation
-- Timesheets were not filtered by company, causing cross-company data bleed
-- when a user belongs to multiple companies.

-- 1. Add company_id column to timesheets
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- 2. Backfill existing timesheets: set company_id from linked event
UPDATE timesheets t
SET company_id = e.company_id
FROM events e
WHERE t.event_id = e.id AND t.company_id IS NULL;

-- 3. Backfill unlinked timesheets: set company_id from shift's event
UPDATE timesheets t
SET company_id = e.company_id
FROM shifts s
JOIN events e ON s.event_id = e.id
WHERE t.shift_id = s.id AND t.company_id IS NULL;

-- 4. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_timesheets_company_id ON timesheets(company_id);
