-- ============================================================
-- OVERWATCH — Chat Enhancements Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Adds: reactions, read receipts, WhatsApp API config
-- ============================================================

-- ─── 1. Chat Reactions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_chat_reactions_message ON chat_reactions(message_id);

ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_reactions_select ON chat_reactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY chat_reactions_insert ON chat_reactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_my_user_id());
CREATE POLICY chat_reactions_delete ON chat_reactions
  FOR DELETE TO authenticated
  USING (user_id = public.get_my_user_id());

-- ─── 2. Read Receipts (last_read_at on chat_members) ────────
ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

-- ─── 3. WhatsApp Business API Config ────────────────────────
CREATE TABLE IF NOT EXISTS wa_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  waba_id         TEXT,
  phone_number_id TEXT,
  access_token    TEXT,
  business_phone  TEXT,
  is_active       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wa_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY wa_config_select ON wa_config
  FOR SELECT TO authenticated
  USING (public.is_company_admin(company_id));
CREATE POLICY wa_config_insert ON wa_config
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(company_id));
CREATE POLICY wa_config_update ON wa_config
  FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id));

-- ─── 4. Ensure chat_members auto-join on channel creation ───
-- (Helper function to add creator as member when they join a channel)
CREATE OR REPLACE FUNCTION public.ensure_chat_member(p_channel_id UUID, p_user_id UUID)
RETURNS VOID AS $$
  INSERT INTO public.chat_members (id, channel_id, user_id, role, joined_at)
  VALUES (gen_random_uuid(), p_channel_id, p_user_id, 'member', now())
  ON CONFLICT (channel_id, user_id) DO NOTHING;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = '';

-- ─── Done ───────────────────────────────────────────────────
