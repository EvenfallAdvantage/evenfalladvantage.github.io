-- Allow company admins (in addition to owners) to supervise/edit/delete their
-- own timesheets, including legacy rows where company_id IS NULL.
-- Applied to OverwatchDB (nneueuvyeohwnspbwfub) as version 20261028180228.

CREATE OR REPLACE FUNCTION public.guard_timesheets()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_me  uuid;
  v_now timestamp := (now() AT TIME ZONE 'utc');  -- clock_in/out are UTC wall time
  v_sup boolean;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_me := public.get_my_user_id();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Supervisor rights apply to other people's rows. On your own row you get
  -- staff rules, except a company owner or admin (who may manage/delete their
  -- own entries).
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id = v_me THEN
      v_sup := CASE
        WHEN NEW.company_id IS NOT NULL THEN
          COALESCE(public.my_company_role(NEW.company_id) IN ('owner', 'admin'), false)
        ELSE
          EXISTS (
            SELECT 1 FROM public.company_memberships cm
            WHERE cm.user_id = v_me
              AND cm.status = 'active'
              AND cm.role IN ('owner', 'admin')
          )
      END;
    ELSE
      v_sup := public.can_supervise_timesheet(NEW.user_id, NEW.company_id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.user_id = v_me THEN
      v_sup := (
        CASE
          WHEN OLD.company_id IS NOT NULL THEN
            COALESCE(public.my_company_role(OLD.company_id) IN ('owner', 'admin'), false)
          ELSE
            EXISTS (
              SELECT 1 FROM public.company_memberships cm
              WHERE cm.user_id = v_me
                AND cm.status = 'active'
                AND cm.role IN ('owner', 'admin')
            )
        END
      ) AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id;
    ELSE
      v_sup := public.can_supervise_timesheet(OLD.user_id, OLD.company_id)
               AND public.can_supervise_timesheet(NEW.user_id, NEW.company_id);
    END IF;
  ELSE
    IF OLD.user_id = v_me THEN
      v_sup := CASE
        WHEN OLD.company_id IS NOT NULL THEN
          COALESCE(public.my_company_role(OLD.company_id) IN ('owner', 'admin'), false)
        ELSE
          EXISTS (
            SELECT 1 FROM public.company_memberships cm
            WHERE cm.user_id = v_me
              AND cm.status = 'active'
              AND cm.role IN ('owner', 'admin')
          )
      END;
    ELSE
      v_sup := public.can_supervise_timesheet(OLD.user_id, OLD.company_id);
    END IF;
  END IF;

  v_sup := COALESCE(v_sup, false);  -- never let a NULL skip the staff rules

  IF TG_OP = 'DELETE' THEN
    IF NOT v_sup THEN
      RAISE EXCEPTION 'Only a supervisor can delete timesheets' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id <> v_me AND NOT v_sup THEN
      RAISE EXCEPTION 'You can only create timesheets for members you supervise' USING ERRCODE = '42501';
    END IF;
    IF NOT v_sup THEN
      -- Staff clock-in: server time, nothing pre-approved.
      IF NEW.company_id IS NOT NULL AND public.my_company_role(NEW.company_id) IS NULL THEN
        RAISE EXCEPTION 'You are not a member of that company' USING ERRCODE = '42501';
      END IF;
      NEW.clock_in      := v_now;
      NEW.clock_out     := NULL;
      NEW.break_minutes := 0;
      NEW.qb_synced     := false;
    END IF;
    -- Nobody inserts a pre-approved row; approval is a separate supervisor step.
    NEW.approved       := false;
    NEW.approved_by_id := NULL;
    NEW.approved_at    := NULL;
    NEW.created_at     := v_now;
    NEW.updated_at     := v_now;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'id, user_id and created_at are immutable' USING ERRCODE = '42501';
  END IF;

  IF NOT v_sup THEN
    IF NEW.clock_in IS DISTINCT FROM OLD.clock_in
       OR NEW.approved IS DISTINCT FROM OLD.approved
       OR NEW.approved_by_id IS DISTINCT FROM OLD.approved_by_id
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.break_minutes IS DISTINCT FROM OLD.break_minutes
       OR NEW.qb_synced IS DISTINCT FROM OLD.qb_synced
       OR NEW.clock_method IS DISTINCT FROM OLD.clock_method
       OR NEW.clock_in_type IS DISTINCT FROM OLD.clock_in_type
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.shift_id IS DISTINCT FROM OLD.shift_id
       OR NEW.event_id IS DISTINCT FROM OLD.event_id THEN
      RAISE EXCEPTION 'Only a supervisor can edit clock-in, approval or assignment fields (use a time change request)'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.clock_out IS DISTINCT FROM OLD.clock_out THEN
      IF OLD.clock_out IS NOT NULL THEN
        RAISE EXCEPTION 'This timesheet is already clocked out; use a time change request'
          USING ERRCODE = '42501';
      END IF;
      NEW.clock_out := v_now;  -- clock-out uses server time; client value ignored
    END IF;
    NEW.updated_at := v_now;
    RETURN NEW;
  END IF;

  -- Supervisor update: may correct times; approval metadata is stamped by the server.
  IF NEW.approved IS DISTINCT FROM OLD.approved THEN
    IF NEW.approved THEN
      NEW.approved_by_id := v_me;
      NEW.approved_at    := v_now;
    ELSE
      NEW.approved_by_id := NULL;
      NEW.approved_at    := NULL;
    END IF;
  ELSE
    NEW.approved_by_id := OLD.approved_by_id;
    NEW.approved_at    := OLD.approved_at;
  END IF;
  NEW.updated_at := v_now;
  RETURN NEW;
END
$$;

DROP POLICY IF EXISTS managers_delete_timesheets ON public.timesheets;
CREATE POLICY managers_delete_timesheets ON public.timesheets
  FOR DELETE
  USING (
    company_id IN (
      SELECT cm.company_id
      FROM public.company_memberships cm
      JOIN public.users u ON u.id = cm.user_id
      WHERE u.supabase_id = (SELECT auth.uid())::text
        AND cm.status = 'active'
        AND cm.role = ANY (ARRAY['manager'::"CompanyRole", 'admin'::"CompanyRole", 'owner'::"CompanyRole"])
    )
    OR (
      company_id IS NULL
      AND user_id = public.get_my_user_id()
      AND EXISTS (
        SELECT 1
        FROM public.company_memberships cm
        WHERE cm.user_id = public.get_my_user_id()
          AND cm.status = 'active'
          AND cm.role IN ('owner', 'admin')
      )
    )
  );
