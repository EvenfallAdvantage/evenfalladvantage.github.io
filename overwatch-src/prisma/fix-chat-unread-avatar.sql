-- Fix: chat_members needs UPDATE policy for read receipts to persist
-- Also: add avatar_url column to chat_channels

-- 1. Add UPDATE policy for chat_members (needed for upsert/last_read_at)
DROP POLICY IF EXISTS "chat_members_update" ON chat_members;
CREATE POLICY "chat_members_update" ON chat_members FOR UPDATE TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));

-- 2. Add avatar_url column to chat_channels
ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS avatar_url TEXT;
