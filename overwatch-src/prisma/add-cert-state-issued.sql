-- ============================================================
-- OVERWATCH — Add state_issued column to certifications
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── ADD state_issued COLUMN ───────────────────────────────

ALTER TABLE certifications
ADD COLUMN IF NOT EXISTS state_issued TEXT;

-- ─── INDEX ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_certifications_state ON certifications(state_issued);

-- ============================================================
-- ✅ Done! state_issued column added to certifications table.
-- ============================================================
