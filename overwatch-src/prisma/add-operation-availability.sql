-- Operation Availability / RSVP
-- Staff indicate availability for upcoming operations.
-- Availability gates shift assignment on the admin side.

CREATE TABLE IF NOT EXISTS operation_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'available' | 'unavailable' | 'tentative' | 'pending'
  notes TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_op_avail_event ON operation_availability(event_id);
CREATE INDEX IF NOT EXISTS idx_op_avail_user ON operation_availability(user_id);

-- RLS (route through events table — same pattern as operation_documents)
ALTER TABLE operation_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avail_select" ON operation_availability
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = operation_availability.event_id)
  );

CREATE POLICY "avail_insert" ON operation_availability
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM events WHERE events.id = event_id)
  );

CREATE POLICY "avail_update" ON operation_availability
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "avail_delete" ON operation_availability
  FOR DELETE USING (user_id = auth.uid());
