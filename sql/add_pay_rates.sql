-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  PAY RATES — April 15, 2026                                    ║
-- ║                                                                 ║
-- ║  Event-based pay rates with company default and per-person      ║
-- ║  overrides. Rate resolution order:                              ║
-- ║    1. Member override (company_memberships.pay_rate_override)   ║
-- ║    2. Event rate (events.pay_rate)                              ║
-- ║    3. Company default (companies.default_pay_rate)              ║
-- ║                                                                 ║
-- ║  Run in Supabase SQL Editor.                                    ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Company default hourly rate
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS default_pay_rate numeric(10,2) DEFAULT NULL;

-- Event/operation hourly rate
ALTER TABLE events
ADD COLUMN IF NOT EXISTS pay_rate numeric(10,2) DEFAULT NULL;

-- Per-member override (takes priority over event and company rates)
ALTER TABLE company_memberships
ADD COLUMN IF NOT EXISTS pay_rate_override numeric(10,2) DEFAULT NULL;

-- Verify
SELECT 'companies.default_pay_rate' AS col, data_type FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'default_pay_rate'
UNION ALL
SELECT 'events.pay_rate', data_type FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'pay_rate'
UNION ALL
SELECT 'memberships.pay_rate_override', data_type FROM information_schema.columns WHERE table_name = 'company_memberships' AND column_name = 'pay_rate_override';
