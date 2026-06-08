-- ============================================================
-- OVERWATCH - Public Incident Reports (Phase 4 / HaloEngage)
-- Run this in: Supabase Dashboard -> SQL Editor -> New Query
-- Adds: public_report_links + public_report_submissions tables.
--
-- Anyone with a link's slug can submit a report (anon insert). The slug is
-- the security token; manage carefully. Submissions land in a triage queue
-- where managers can "promote to incident" (creating an incidents row with
-- source='public' and linking back).
-- ============================================================

-- =================================================================
-- 1. Public Report Links
-- =================================================================
CREATE TABLE IF NOT EXISTS public_report_links (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  team_id           UUID REFERENCES teams(id) ON DELETE SET NULL,
  slug              TEXT NOT NULL UNIQUE,
  label             TEXT NOT NULL,
  default_type      TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_report_links_company ON public_report_links(company_id);
CREATE INDEX IF NOT EXISTS idx_public_report_links_slug ON public_report_links(slug);
CREATE INDEX IF NOT EXISTS idx_public_report_links_team ON public_report_links(team_id) WHERE team_id IS NOT NULL;

ALTER TABLE public_report_links ENABLE ROW LEVEL SECURITY;

-- Anonymous users can read ACTIVE links (so the public page can resolve a slug),
-- but only the bare minimum needed to render the form.
DROP POLICY IF EXISTS public_report_links_anon_select ON public_report_links;
CREATE POLICY public_report_links_anon_select ON public_report_links
  FOR SELECT TO anon
  USING (is_active);

-- Authenticated members read all links for their company; admins manage.
DROP POLICY IF EXISTS public_report_links_select ON public_report_links;
CREATE POLICY public_report_links_select ON public_report_links
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS public_report_links_insert ON public_report_links;
CREATE POLICY public_report_links_insert ON public_report_links
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(company_id));

DROP POLICY IF EXISTS public_report_links_update ON public_report_links;
CREATE POLICY public_report_links_update ON public_report_links
  FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id));

DROP POLICY IF EXISTS public_report_links_delete ON public_report_links;
CREATE POLICY public_report_links_delete ON public_report_links
  FOR DELETE TO authenticated
  USING (public.is_company_admin(company_id));

COMMENT ON TABLE public_report_links IS 'Per-company QR/share-link tokens for the public report intake (Phase 4 / HaloEngage). Slug is the security token; treat as semi-secret.';

-- =================================================================
-- 2. Public Report Submissions
-- =================================================================
CREATE TABLE IF NOT EXISTS public_report_submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id           UUID NOT NULL REFERENCES public_report_links(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reporter_name     TEXT,
  reporter_phone    TEXT,
  reporter_email    TEXT,
  body              TEXT NOT NULL,
  location          TEXT,
  location_lat      DOUBLE PRECISION,
  location_lng      DOUBLE PRECISION,
  media             JSONB DEFAULT '[]'::jsonb,
  status            TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','triaging','promoted','dismissed')),
  incident_id       UUID REFERENCES incidents(id) ON DELETE SET NULL,
  triaged_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  triaged_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_report_submissions_company ON public_report_submissions(company_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_public_report_submissions_link ON public_report_submissions(link_id);
CREATE INDEX IF NOT EXISTS idx_public_report_submissions_incident ON public_report_submissions(incident_id) WHERE incident_id IS NOT NULL;

ALTER TABLE public_report_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can submit via the public form.
DROP POLICY IF EXISTS public_report_submissions_anon_insert ON public_report_submissions;
CREATE POLICY public_report_submissions_anon_insert ON public_report_submissions
  FOR INSERT TO anon
  WITH CHECK (
    -- Anon-insert only allowed if the link is active and matches the company_id.
    EXISTS (
      SELECT 1 FROM public_report_links l
      WHERE l.id = public_report_submissions.link_id
      AND l.company_id = public_report_submissions.company_id
      AND l.is_active
    )
  );

-- Members of the company can read; admins manage status/promote.
DROP POLICY IF EXISTS public_report_submissions_select ON public_report_submissions;
CREATE POLICY public_report_submissions_select ON public_report_submissions
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS public_report_submissions_update ON public_report_submissions;
CREATE POLICY public_report_submissions_update ON public_report_submissions
  FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS public_report_submissions_delete ON public_report_submissions;
CREATE POLICY public_report_submissions_delete ON public_report_submissions
  FOR DELETE TO authenticated
  USING (public.is_company_admin(company_id));

COMMENT ON TABLE public_report_submissions IS 'Public-facing report intake queue. Anonymous inserts are gated by an active link FK; member RLS gates read/update.';

-- =================================================================
-- 3. Public Report Messages (for reply thread with reporter, Phase 4.7)
-- =================================================================
CREATE TABLE IF NOT EXISTS public_report_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     UUID NOT NULL REFERENCES public_report_submissions(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  direction         TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  channel           TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms','email','note')),
  body              TEXT NOT NULL,
  sent_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  external_id       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_report_messages_submission ON public_report_messages(submission_id, created_at);
CREATE INDEX IF NOT EXISTS idx_public_report_messages_company ON public_report_messages(company_id);

ALTER TABLE public_report_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_report_messages_select ON public_report_messages;
CREATE POLICY public_report_messages_select ON public_report_messages
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS public_report_messages_insert ON public_report_messages;
CREATE POLICY public_report_messages_insert ON public_report_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS public_report_messages_delete ON public_report_messages;
CREATE POLICY public_report_messages_delete ON public_report_messages
  FOR DELETE TO authenticated
  USING (public.is_company_admin(company_id));

COMMENT ON TABLE public_report_messages IS 'Thread of inbound/outbound messages exchanged with the public reporter for a given submission.';
