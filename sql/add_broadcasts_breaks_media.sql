-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  Phase D Migration: Broadcasts + Breaks + Incident Media       ║
-- ║  Run in Supabase SQL Editor                                     ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- 1. BROADCASTS TABLE (emergency messaging with ack tracking)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  sender_id UUID NOT NULL REFERENCES public.users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent', 'critical')),
  target TEXT NOT NULL DEFAULT 'all' CHECK (target IN ('all', 'on_duty', 'managers')),
  acknowledged_by JSONB DEFAULT '[]',
  total_recipients INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_company ON public.broadcasts(company_id);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY broadcasts_select ON public.broadcasts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = broadcasts.company_id
      AND u.supabase_id = auth.uid()::text
  ));

CREATE POLICY broadcasts_insert ON public.broadcasts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = broadcasts.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

CREATE POLICY broadcasts_update ON public.broadcasts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = broadcasts.company_id
      AND u.supabase_id = auth.uid()::text
  ));


-- ═══════════════════════════════════════════════════════════════════
-- 2. TIMESHEET BREAKS TABLE (meal/rest break tracking)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.timesheet_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id UUID NOT NULL REFERENCES public.timesheets(id) ON DELETE CASCADE,
  break_type TEXT NOT NULL DEFAULT 'rest' CHECK (break_type IN ('meal', 'rest', 'other')),
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_breaks_timesheet ON public.timesheet_breaks(timesheet_id);

ALTER TABLE public.timesheet_breaks ENABLE ROW LEVEL SECURITY;

-- Staff can manage their own breaks
CREATE POLICY breaks_select ON public.timesheet_breaks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.timesheets t
    JOIN public.users u ON u.id = t.user_id
    WHERE t.id = timesheet_breaks.timesheet_id
      AND u.supabase_id = auth.uid()::text
  ));

CREATE POLICY breaks_insert ON public.timesheet_breaks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.timesheets t
    JOIN public.users u ON u.id = t.user_id
    WHERE t.id = timesheet_breaks.timesheet_id
      AND u.supabase_id = auth.uid()::text
  ));

CREATE POLICY breaks_update ON public.timesheet_breaks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.timesheets t
    JOIN public.users u ON u.id = t.user_id
    WHERE t.id = timesheet_breaks.timesheet_id
      AND u.supabase_id = auth.uid()::text
  ));


-- ═══════════════════════════════════════════════════════════════════
-- 3. INCIDENT MEDIA TABLE (photo/video/audio attachments)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.incident_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'photo' CHECK (file_type IN ('photo', 'video', 'audio', 'document')),
  file_name TEXT NOT NULL DEFAULT '',
  file_size INTEGER DEFAULT 0,
  uploaded_by UUID NOT NULL REFERENCES public.users(id),
  hash TEXT,  -- SHA-256 for evidence integrity / chain of custody
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_media_incident ON public.incident_media(incident_id);

ALTER TABLE public.incident_media ENABLE ROW LEVEL SECURITY;

-- Company members can view incident media
CREATE POLICY incident_media_select ON public.incident_media FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.incidents i
    JOIN public.company_memberships cm ON cm.company_id = i.company_id
    JOIN public.users u ON u.id = cm.user_id
    WHERE i.id = incident_media.incident_id
      AND u.supabase_id = auth.uid()::text
  ));

-- Staff can upload media to incidents
CREATE POLICY incident_media_insert ON public.incident_media FOR INSERT
  WITH CHECK (uploaded_by IN (
    SELECT u.id FROM public.users u WHERE u.supabase_id = auth.uid()::text
  ));

-- Managers can delete media
CREATE POLICY incident_media_delete ON public.incident_media FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.incidents i
    JOIN public.company_memberships cm ON cm.company_id = i.company_id
    JOIN public.users u ON u.id = cm.user_id
    WHERE i.id = incident_media.incident_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));


-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

SELECT 'broadcasts' AS tbl, count(*) FROM public.broadcasts
UNION ALL
SELECT 'timesheet_breaks', count(*) FROM public.timesheet_breaks
UNION ALL
SELECT 'incident_media', count(*) FROM public.incident_media;
