-- ============================================================
-- Backfill: Link existing timesheets to shifts/operations
-- Matches timesheets to shifts by user_id + overlapping time
-- ============================================================

-- Set shift_id and event_id on timesheets where clock_in falls
-- within a matching shift's time window (with 30min buffer)
UPDATE timesheets t
SET
  shift_id = s.id,
  event_id = s.event_id
FROM shifts s
WHERE t.shift_id IS NULL
  AND t.user_id = s.assigned_user_id
  AND t.clock_in >= (s.start_time - INTERVAL '30 minutes')
  AND t.clock_in <= (s.end_time + INTERVAL '30 minutes');
