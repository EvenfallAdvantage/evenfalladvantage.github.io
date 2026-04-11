-- ═══════════════════════════════════════════════════════════════
-- Direct Messages between staff members
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS direct_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  file_url      TEXT,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Users can read DMs they sent or received within their company
CREATE POLICY "dm_read" ON direct_messages FOR SELECT TO authenticated
  USING (
    (from_user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
     OR to_user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text))
    AND company_id IN (
      SELECT cm.company_id FROM company_memberships cm
      JOIN users u ON u.id = cm.user_id
      WHERE u.supabase_id = auth.uid()::text
    )
  );

-- Users can send DMs (insert) as themselves
CREATE POLICY "dm_insert" ON direct_messages FOR INSERT TO authenticated
  WITH CHECK (
    from_user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
  );

-- Users can update DMs they received (to mark as read)
CREATE POLICY "dm_update" ON direct_messages FOR UPDATE TO authenticated
  USING (
    to_user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
  );

-- Enable realtime for live message delivery
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;

-- Indexes for fast lookups
CREATE INDEX idx_dm_conversation ON direct_messages(company_id, from_user_id, to_user_id, created_at DESC);
CREATE INDEX idx_dm_recipient ON direct_messages(to_user_id, read_at, created_at DESC);
