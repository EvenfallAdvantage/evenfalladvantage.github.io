-- =====================================================
-- LEGACY BRIDGE — Account Linking + Sync
-- =====================================================
-- Links Overwatch users to legacy student/instructor/admin accounts
-- Run this on the OVERWATCH Supabase (nneueuvyeohwnspbwfub)
-- =====================================================

-- 1. Account linking table
CREATE TABLE IF NOT EXISTS legacy_account_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  legacy_supabase_url TEXT NOT NULL DEFAULT 'https://vaagvairvwmgyzsmymhs.supabase.co',
  legacy_user_id UUID NOT NULL,
  legacy_role TEXT NOT NULL CHECK (legacy_role IN ('student', 'instructor', 'admin')),
  legacy_email TEXT,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'active' CHECK (sync_status IN ('active', 'paused', 'error')),
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, legacy_role)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_legacy_links_user ON legacy_account_links(user_id);
CREATE INDEX IF NOT EXISTS idx_legacy_links_legacy_id ON legacy_account_links(legacy_user_id);
CREATE INDEX IF NOT EXISTS idx_legacy_links_role ON legacy_account_links(legacy_role);

-- RLS
ALTER TABLE legacy_account_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own legacy links' AND tablename = 'legacy_account_links') THEN
    CREATE POLICY "Users can read own legacy links" ON legacy_account_links FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create own legacy links' AND tablename = 'legacy_account_links') THEN
    CREATE POLICY "Users can create own legacy links" ON legacy_account_links FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own legacy links' AND tablename = 'legacy_account_links') THEN
    CREATE POLICY "Users can update own legacy links" ON legacy_account_links FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Sync log (tracks what was synced and when)
CREATE TABLE IF NOT EXISTS legacy_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('progress', 'enrollment', 'certificate', 'assessment', 'full')),
  sync_direction TEXT NOT NULL CHECK (sync_direction IN ('legacy_to_overwatch', 'overwatch_to_legacy', 'bidirectional')),
  records_synced INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
  error_message TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_user ON legacy_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_type ON legacy_sync_log(sync_type);

ALTER TABLE legacy_sync_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own sync logs' AND tablename = 'legacy_sync_log') THEN
    CREATE POLICY "Users can read own sync logs" ON legacy_sync_log FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create own sync logs' AND tablename = 'legacy_sync_log') THEN
    CREATE POLICY "Users can create own sync logs" ON legacy_sync_log FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
