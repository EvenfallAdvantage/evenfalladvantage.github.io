-- ============================================================
-- Operations Unification Migration
-- Links timesheets, field reports, and incidents to operations
-- ============================================================

-- Phase 1: Link timesheets to shifts/operations
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS clock_in_type text DEFAULT 'shift';
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_timesheets_shift_id ON timesheets(shift_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_event_id ON timesheets(event_id);

-- Phase 2: Link form submissions to operations
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL;
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS timesheet_id uuid REFERENCES timesheets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_form_submissions_shift_id ON form_submissions(shift_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_event_id ON form_submissions(event_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_timesheet_id ON form_submissions(timesheet_id);

-- Incidents already have event_id — just add index if missing
CREATE INDEX IF NOT EXISTS idx_incidents_event_id ON incidents(event_id);
