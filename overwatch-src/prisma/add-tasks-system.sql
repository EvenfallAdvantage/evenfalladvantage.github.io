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
