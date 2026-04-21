-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  POST ORDERS + SHIFT IMPORT — April 15, 2026                   ║
-- ║                                                                 ║
-- ║  Events have default post orders (rich text).                   ║
-- ║  Shifts can override with their own post orders.                ║
-- ║  Resolution: shift post_orders → event post_orders → null       ║
-- ║                                                                 ║
-- ║  Run in Supabase SQL Editor.                                    ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Event-level post orders (default for all shifts)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS post_orders text DEFAULT NULL;

-- Shift-level post orders (override for specific shift)
ALTER TABLE shifts
ADD COLUMN IF NOT EXISTS post_orders text DEFAULT NULL;

-- Verify
SELECT 'events.post_orders' AS col, data_type FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'post_orders'
UNION ALL
SELECT 'shifts.post_orders', data_type FROM information_schema.columns WHERE table_name = 'shifts' AND column_name = 'post_orders';
