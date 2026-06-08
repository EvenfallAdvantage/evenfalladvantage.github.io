-- ============================================================================
-- OVERWATCH - PENDING MIGRATIONS BUNDLE
-- Generated: 2026-06-08T17:25:42
-- Project ref: nneueuvyeohwnspbwfub
--
-- Apply order:
--   1. add-tasks-system.sql              (Phase 2 - tasks, watchers, checklist, comments, recurring rpc)
--   2. add-public-incident-reports.sql   (Phase 4 - public report links, submissions, messages)
--   3. extend_integrations_config_sms.sql (Phase 4 - adds from_number + widens delivery_method check)
--   4. add_sms_send_log.sql              (Phase 4 - SMS audit log; depends on public_report_submissions)
--
-- Idempotency: every file uses CREATE TABLE IF NOT EXISTS / DROP POLICY
-- IF EXISTS / DO blocks. Safe to re-run.
--
-- HOW TO USE:
--   1. Open Supabase Dashboard -> SQL Editor for project nneueuvyeohwnspbwfub
--   2. Paste this whole file into a new query
--   3. Click 'Run'
--   4. Look for green 'Success' at the bottom; any error stops the run.
-- ============================================================================

-- ============================================================================
-- FILE: overwatch-src\prisma\add-tasks-system.sql
-- ============================================================================
-- ============================================================
-- OVERWATCH - Tasks System Migration (Phase 2 / HaloTaskManager parity)
-- Run this in: Supabase Dashboard -> SQL Editor -> New Query
-- Adds: general task system (separate from onboarding checklists)
-- Tables: tasks, task_watchers, task_checklist_items, task_comments
-- ============================================================

-- =================================================================
-- 1. Tasks Table
-- =================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  team_id           UUID REFERENCES teams(id) ON DELETE SET NULL,
  incident_id       UUID REFERENCES incidents(id) ON DELETE SET NULL,
  parent_task_id    UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  status            TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','blocked','done','cancelled')),
  priority          TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to       UUID REFERENCES users(id) ON DELETE SET NULL,
  due_at            TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  sort_order        INT DEFAULT 0,
  recurrence        JSONB,
  custom_fields     JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_company_status ON tasks(company_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_incident ON tasks(incident_id) WHERE incident_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_team ON tasks(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at) WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence ON tasks(company_id) WHERE recurrence IS NOT NULL;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_select ON tasks;
CREATE POLICY tasks_select ON tasks
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS tasks_insert ON tasks;
CREATE POLICY tasks_insert ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS tasks_update ON tasks;
CREATE POLICY tasks_update ON tasks
  FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS tasks_delete ON tasks;
CREATE POLICY tasks_delete ON tasks
  FOR DELETE TO authenticated
  USING (public.is_company_admin(company_id));

COMMENT ON TABLE tasks IS 'General task system (Phase 2 / HaloTaskManager). Separate from onboarding checklists. Supports subtasks, recurrence, incident linkage.';

-- =================================================================
-- 2. Task Watchers
-- =================================================================
CREATE TABLE IF NOT EXISTS task_watchers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_watchers_task ON task_watchers(task_id);
CREATE INDEX IF NOT EXISTS idx_task_watchers_user ON task_watchers(user_id);

ALTER TABLE task_watchers ENABLE ROW LEVEL SECURITY;

-- Scope through parent task: read if you can read the task; write if member of task company
DROP POLICY IF EXISTS task_watchers_select ON task_watchers;
CREATE POLICY task_watchers_select ON task_watchers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_watchers.task_id
      AND public.is_company_member(t.company_id)
    )
  );

DROP POLICY IF EXISTS task_watchers_insert ON task_watchers;
CREATE POLICY task_watchers_insert ON task_watchers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_watchers.task_id
      AND public.is_company_member(t.company_id)
    )
  );

DROP POLICY IF EXISTS task_watchers_delete ON task_watchers;
CREATE POLICY task_watchers_delete ON task_watchers
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_watchers.task_id
      AND public.is_company_member(t.company_id)
    )
  );

COMMENT ON TABLE task_watchers IS 'Users following a task for notification purposes.';

-- =================================================================
-- 3. Task Checklist Items
-- =================================================================
CREATE TABLE IF NOT EXISTS task_checklist_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  is_done         BOOLEAN NOT NULL DEFAULT false,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_checklist_task ON task_checklist_items(task_id, sort_order);

ALTER TABLE task_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_checklist_select ON task_checklist_items;
CREATE POLICY task_checklist_select ON task_checklist_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_checklist_items.task_id
      AND public.is_company_member(t.company_id)
    )
  );

DROP POLICY IF EXISTS task_checklist_insert ON task_checklist_items;
CREATE POLICY task_checklist_insert ON task_checklist_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_checklist_items.task_id
      AND public.is_company_member(t.company_id)
    )
  );

DROP POLICY IF EXISTS task_checklist_update ON task_checklist_items;
CREATE POLICY task_checklist_update ON task_checklist_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_checklist_items.task_id
      AND public.is_company_member(t.company_id)
    )
  );

DROP POLICY IF EXISTS task_checklist_delete ON task_checklist_items;
CREATE POLICY task_checklist_delete ON task_checklist_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_checklist_items.task_id
      AND public.is_company_member(t.company_id)
    )
  );

COMMENT ON TABLE task_checklist_items IS 'Per-task checklist items (subtasks lite).';

-- =================================================================
-- 4. Task Comments / Activity Log
-- =================================================================
CREATE TABLE IF NOT EXISTS task_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  content         TEXT NOT NULL,
  type            TEXT DEFAULT 'note' CHECK (type IN ('note','status_change','update','transfer')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id, created_at);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_comments_select ON task_comments;
CREATE POLICY task_comments_select ON task_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments.task_id
      AND public.is_company_member(t.company_id)
    )
  );

DROP POLICY IF EXISTS task_comments_insert ON task_comments;
CREATE POLICY task_comments_insert ON task_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments.task_id
      AND public.is_company_member(t.company_id)
    )
  );

DROP POLICY IF EXISTS task_comments_delete ON task_comments;
CREATE POLICY task_comments_delete ON task_comments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments.task_id
      AND public.is_company_admin(t.company_id)
    )
  );

COMMENT ON TABLE task_comments IS 'Task activity log: comments + auto-generated status_change / update / transfer entries.';

-- =================================================================
-- 5. Recurring task generator (called by pg_cron)
-- =================================================================
-- generate_recurring_tasks - reads tasks with non-null recurrence and spawns
-- due instances. Recurrence rule JSONB shape:
--   { "freq": "daily" | "weekly" | "monthly", "interval": int, "next_at": timestamptz }
-- The function updates next_at after creating each instance.
CREATE OR REPLACE FUNCTION public.generate_recurring_tasks(p_company_id UUID DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rule          JSONB;
  v_next_at       TIMESTAMPTZ;
  v_freq          TEXT;
  v_interval      INT;
  v_new_next_at   TIMESTAMPTZ;
  v_count         INT := 0;
  rec             RECORD;
BEGIN
  FOR rec IN
    SELECT id, company_id, team_id, title, description, priority, created_by, assigned_to,
           custom_fields, recurrence
    FROM public.tasks
    WHERE recurrence IS NOT NULL
      AND (p_company_id IS NULL OR company_id = p_company_id)
  LOOP
    v_rule := rec.recurrence;
    v_next_at := (v_rule->>'next_at')::TIMESTAMPTZ;
    IF v_next_at IS NULL OR v_next_at > now() THEN
      CONTINUE;
    END IF;

    v_freq := COALESCE(v_rule->>'freq', 'daily');
    v_interval := COALESCE((v_rule->>'interval')::INT, 1);

    -- Spawn new task instance (status=todo, completed_at=null)
    INSERT INTO public.tasks (
      company_id, team_id, parent_task_id, title, description, status, priority,
      created_by, assigned_to, due_at, custom_fields
    ) VALUES (
      rec.company_id, rec.team_id, rec.id, rec.title, rec.description, 'todo', rec.priority,
      rec.created_by, rec.assigned_to, v_next_at, COALESCE(rec.custom_fields, '{}'::jsonb)
    );

    -- Advance next_at by interval
    v_new_next_at := CASE v_freq
      WHEN 'daily' THEN v_next_at + (v_interval || ' days')::INTERVAL
      WHEN 'weekly' THEN v_next_at + (v_interval || ' weeks')::INTERVAL
      WHEN 'monthly' THEN v_next_at + (v_interval || ' months')::INTERVAL
      ELSE v_next_at + (v_interval || ' days')::INTERVAL
    END;

    UPDATE public.tasks
    SET recurrence = jsonb_set(v_rule, '{next_at}', to_jsonb(v_new_next_at::TEXT)),
        updated_at = now()
    WHERE id = rec.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_recurring_tasks(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_recurring_tasks(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_recurring_tasks(UUID) TO authenticated;

COMMENT ON FUNCTION public.generate_recurring_tasks(UUID) IS 'Generates instances of recurring tasks whose next_at has passed. Designed to be called by pg_cron (e.g. every hour). Returns the number of instances created.';


-- ============================================================================
-- FILE: overwatch-src\prisma\add-public-incident-reports.sql
-- ============================================================================
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


-- ============================================================================
-- FILE: sql\extend_integrations_config_sms.sql
-- ============================================================================
-- â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
-- â•‘  EXTEND integrations_config FOR SMS SENDING                       â•‘
-- â•‘                                                                   â•‘
-- â•‘  Adds columns the new sms-send / sms-reply-to-reporter Edge       â•‘
-- â•‘  Functions need to route SMS through a per-company Twilio account â•‘
-- â•‘  or the platform fallback.                                        â•‘
-- â•‘                                                                   â•‘
-- â•‘  Schema rules:                                                    â•‘
-- â•‘   - integrations_config.provider = 'sms' is the kind.             â•‘
-- â•‘   - delivery_method is the actual transport: twilio | platform.   â•‘
-- â•‘   - vault_secret_id points at vault.secrets that holds the Twilio â•‘
-- â•‘     creds (Account SID + Auth Token + optional from number) as a  â•‘
-- â•‘     JSON blob.                                                    â•‘
-- â•‘   - verified_at gates whether the row is usable (no verified_at   â•‘
-- â•‘     â‡’ platform fallback). The new sms-test-send Edge Function     â•‘
-- â•‘     stamps verified_at after a successful real send.              â•‘
-- â•‘                                                                   â•‘
-- â•‘  We reuse the existing integrations_config columns added by the   â•‘
-- â•‘  email migration: verified_at, vault_secret_id, test_sent_to.     â•‘
-- â•‘  New here: from_number.                                           â•‘
-- â•‘                                                                   â•‘
-- â•‘  Idempotent â€” safe to re-run.                                     â•‘
-- â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

ALTER TABLE integrations_config
  ADD COLUMN IF NOT EXISTS from_number TEXT;

COMMENT ON COLUMN integrations_config.from_number IS
  'For provider=sms rows: the sender E.164 number or messaging-service SID.';

-- Widen the delivery_method check constraint to accept 'twilio'.
DO $$ BEGIN
  ALTER TABLE integrations_config
    DROP CONSTRAINT IF EXISTS integrations_config_delivery_method_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE integrations_config
    ADD CONSTRAINT integrations_config_delivery_method_check
    CHECK (delivery_method IS NULL
           OR delivery_method IN ('smtp', 'resend', 'platform', 'twilio'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- FILE: sql\add_sms_send_log.sql
-- ============================================================================
-- â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
-- â•‘  SMS SEND LOG                                                     â•‘
-- â•‘                                                                   â•‘
-- â•‘  Every outbound message from the sms-send / sms-reply-to-reporter â•‘
-- â•‘  Edge Functions lands here. Used by the HQ Config â†’ SMS page to   â•‘
-- â•‘  show the recent-sends list, and by the Security Center for       â•‘
-- â•‘  audit.                                                           â•‘
-- â•‘                                                                   â•‘
-- â•‘  Optional submission_id back-link is for messages sent in reply   â•‘
-- â•‘  to a public_report_submissions row (Phase 4.7 reporter thread).  â•‘
-- â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE TABLE IF NOT EXISTS sms_send_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('twilio', 'platform')),
  to_number       TEXT NOT NULL,
  from_number     TEXT NOT NULL,
  body            TEXT NOT NULL,
  purpose         TEXT NOT NULL CHECK (purpose IN (
    'reporter_reply', 'broadcast', 'shift_reminder', 'test_send', 'other'
  )),
  status          TEXT NOT NULL CHECK (status IN ('sent', 'rejected', 'failed')),
  provider_id     TEXT,
  error_message   TEXT,
  submission_id   UUID REFERENCES public_report_submissions(id) ON DELETE SET NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sms_send_log_company_sent_at
  ON sms_send_log(company_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_send_log_to_number
  ON sms_send_log(to_number);
CREATE INDEX IF NOT EXISTS idx_sms_send_log_submission
  ON sms_send_log(submission_id) WHERE submission_id IS NOT NULL;

ALTER TABLE sms_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sms_send_log_select ON sms_send_log;
CREATE POLICY sms_send_log_select ON sms_send_log
  FOR SELECT TO authenticated
  USING (public.is_company_admin(company_id));

-- Writes from Edge Functions only (service-role).

COMMENT ON TABLE sms_send_log IS
  'Per-message log of outbound SMS dispatched by the sms-send / sms-reply-to-reporter Edge Functions. Visible to admins/managers/owners of the owning company.';

