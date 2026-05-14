-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  DROP EVENT PAY RATE — May 14, 2026                              ║
-- ║                                                                   ║
-- ║  Pay rates are now exclusively per-employee (member override on   ║
-- ║  company_memberships) with optional company default. Operations   ║
-- ║  no longer carry their own pay rate.                              ║
-- ║                                                                   ║
-- ║  New cascade:                                                     ║
-- ║    1. Member override (company_memberships.pay_rate_override)     ║
-- ║    2. Company default (companies.default_pay_rate)                ║
-- ║                                                                   ║
-- ║  Run in Supabase SQL Editor.                                      ║
-- ╚══════════════════════════════════════════════════════════════════╝

ALTER TABLE events
  DROP COLUMN IF EXISTS pay_rate;

-- Verify
SELECT column_name FROM information_schema.columns
WHERE table_name = 'events' AND column_name = 'pay_rate';
-- Expected: 0 rows (column removed)
