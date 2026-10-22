-- Security: members could read and mark ANY company member's notifications
-- (SELECT/UPDATE were is_company_member(company_id)). Restrict to the
-- recipient; company admins keep access. NOT APPLIED; needs owner approval.
-- INSERT stays "any member of the company" (app alerts are sent peer→peer
-- and member→manager); DELETE stays admin-only. No new tables.

DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT public.get_my_user_id()) OR public.is_company_admin(company_id));

DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT public.get_my_user_id()) OR public.is_company_admin(company_id))
  WITH CHECK (user_id = (SELECT public.get_my_user_id()) OR public.is_company_admin(company_id));

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
