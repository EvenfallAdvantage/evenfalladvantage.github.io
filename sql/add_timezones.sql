-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  TIMEZONE SUPPORT — April 15, 2026                              ║
-- ║                                                                 ║
-- ║  Events have a timezone field (e.g., 'America/Los_Angeles').    ║
-- ║  Companies have a default timezone as fallback.                  ║
-- ║  Shift times are stored in UTC but interpreted/displayed in     ║
-- ║  the event timezone (or company timezone if event has none).    ║
-- ║                                                                 ║
-- ║  Run in Supabase SQL Editor.                                    ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Event timezone (IANA format, e.g., 'America/Los_Angeles')
ALTER TABLE events
ADD COLUMN IF NOT EXISTS timezone text DEFAULT NULL;

-- Company default timezone (fallback when event has no timezone)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Los_Angeles';

-- Verify
SELECT 'events.timezone' AS col, data_type FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'timezone'
UNION ALL
SELECT 'companies.timezone', data_type FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'timezone';
