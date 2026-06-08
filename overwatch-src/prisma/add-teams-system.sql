-- ============================================================
-- OVERWATCH — Teams System Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Adds: teams within company, team_members join table
-- ============================================================

-- ─── 1. Teams Table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  color           TEXT DEFAULT '#6366f1',
  icon            TEXT,
  is_archived     BOOLEAN DEFAULT false,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_company ON teams(company_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Members can read teams; admins can manage
CREATE POLICY teams_select ON teams
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY teams_insert ON teams
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY teams_update ON teams
  FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id));

CREATE POLICY teams_delete ON teams
  FOR DELETE TO authenticated
  USING (public.is_company_admin(company_id));

COMMENT ON TABLE teams IS 'Teams within a company for multi-team coordination (HaloFusion).';

-- ─── 2. Team Members Join Table ──────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT DEFAULT 'member' CHECK (role IN ('lead','member')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_user ON team_members(team_id, user_id);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Members can read their teams; admins can manage membership
CREATE POLICY team_members_select ON team_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      JOIN company_memberships cm ON cm.company_id = t.company_id
      WHERE t.id = team_members.team_id
      AND cm.user_id = auth.uid()::uuid
      AND cm.role IN ('owner','admin','manager')
    )
  );

CREATE POLICY team_members_insert ON team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t
      JOIN company_memberships cm ON cm.company_id = t.company_id
      WHERE t.id = team_members.team_id
      AND cm.user_id = auth.uid()::uuid
      AND cm.role IN ('owner','admin','manager')
    )
  );

CREATE POLICY team_members_delete ON team_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      JOIN company_memberships cm ON cm.company_id = t.company_id
      WHERE t.id = team_members.team_id
      AND cm.user_id = auth.uid()::uuid
      AND cm.role IN ('owner','admin','manager')
    )
  );

COMMENT ON TABLE team_members IS 'Join table linking users to teams.';

-- ─── 3. Team Memberships View (convenience) ──────────────────
CREATE OR REPLACE VIEW public.team_memberships AS
SELECT
  tm.id,
  tm.team_id,
  tm.user_id,
  tm.role,
  tm.created_at,
  t.company_id,
  u.email AS user_email,
  u.first_name,
  u.last_name
FROM team_members tm
JOIN teams t ON t.id = tm.team_id
JOIN users u ON u.id = tm.user_id;

COMMENT ON VIEW public.team_memberships IS 'Convenience view for team membership data.';

-- ─── 4. Helper Functions ─────────────────────────────────────

-- Check if user is a team lead or member
CREATE OR REPLACE FUNCTION public.is_team_member(team_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_team_company_id UUID;
BEGIN
  SELECT company_id INTO v_team_company_id FROM teams WHERE id = team_id;
  IF v_team_company_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN public.is_company_member(v_team_company_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_team_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_team_member(UUID) TO authenticated;

COMMENT ON FUNCTION public.is_team_member(UUID) IS 'Check if current user is a member of the given team.';
