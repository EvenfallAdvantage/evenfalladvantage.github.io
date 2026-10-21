# SECURITY DEFINER function review (2026-10-21)

Source: Supabase security advisors 0028/0029 on OverwatchDB, caller map from repo `main` @ 1c91fbb (client `rpc()` calls incl. multi-line, Edge Functions, `js/`) and the live catalog (RLS policies, views, triggers, invoker functions, column defaults, cron).

| Function | anon | authenticated | Decision | Caller / reason |
|---|---|---|---|---|
| `accept_roster_invitation()` |  | yes | Keep | /auth/update-password (multi-line rpc call) |
| `ack_post_orders(p_shift_id uuid)` |  | yes | Keep | client rpc() |
| `add_client_member(p_company_id uuid, p_email text)` |  | yes | Keep | client rpc() |
| `admin_get_training_quiz_answers(p_quiz_id uuid)` |  | yes | Keep | client rpc() |
| `admin_save_training_quiz_questions(p_quiz_id uuid, p_questions jsonb)` |  | yes | Keep | client rpc() |
| `admin_set_training_quiz_answer(p_question_id uuid, p_correct_answer text, p_explanation text)` |  | yes | Keep | instructor API covered by training_eadb_consolidation test; kept |
| `aircraft_track(p_hex text)` |  | yes | Keep | opensky-proxy reads as the calling user |
| `can_supervise_timesheet(p_user_id uuid, p_company_id uuid)` |  | yes | Keep | called by invoker trigger guard_timesheets |
| `can_view_member_files(p_supabase_id text)` |  | yes | Keep | RLS policy helper |
| `company_exists(p_company_id uuid)` | yes | yes | Keep | RLS policy helper; anon: RLS policies evaluated for anon (public pages) |
| `convert_applicant_to_roster(p_applicant_id uuid, p_company_id uuid)` |  | yes | Keep | client rpc() |
| `create_company_with_owner(p_company_name text, p_supabase_id text, p_email text, p_phone text, p_first_name text, p_last_name text)` |  | yes | Keep | client rpc() |
| `create_roster_member(p_company_id uuid, p_first_name text, p_last_name text, p_email text, p_phone text, p_role text)` |  | yes | Keep | client rpc() |
| `generate_recurring_tasks(p_company_id uuid)` |  | yes | Keep | client rpc() |
| `get_company_join_code(p_company_id uuid)` |  | yes | Keep | client rpc() |
| `get_intake_by_token(p_token text)` | yes | yes | Keep | client rpc(); anon: public client-intake link |
| `get_my_user_id()` |  | yes | Keep | RLS policy helper |
| `get_partner_companies()` | yes | yes | Keep | client rpc(); anon: landing page partner strip (signed out) |
| `get_public_company(p_company_id uuid, p_slug text)` | yes | yes | Keep | client rpc(); anon: public careers / company page |
| `get_vapid_public_key()` | yes | yes | **Revoke** (migration 20261021200000) | no callers found |
| `grade_training_quiz(p_quiz_id uuid, p_answers jsonb, p_state_code text)` |  | yes | Keep | client rpc() |
| `is_company_admin(comp_id uuid)` |  | yes | Keep | RLS + Edge Functions |
| `is_company_manager(p_company_id uuid)` |  | yes | Keep | RLS policy helper |
| `is_company_member(comp_id uuid)` |  | yes | Keep | RLS policy helper |
| `is_company_owner_admin(p_company_id uuid)` |  | yes | Keep | RLS policy helper |
| `is_team_member(team_id uuid)` |  | yes | **Revoke** (migration 20261021200000) | no callers found |
| `join_company_by_code(p_join_code text, p_supabase_id text, p_email text, p_phone text, p_first_name text, p_last_name text)` |  | yes | Keep | client rpc() |
| `log_audit_event(p_event_type text, p_outcome text, p_company_id uuid, p_metadata jsonb, p_user_agent text, p_entity_type text)` |  | yes | Keep | client rpc() |
| `log_evidence_event(p_media_id uuid, p_action text, p_hash text, p_note text)` |  | yes | Keep | client rpc() |
| `my_company_role(p_company_id uuid)` |  | yes | Keep | RLS policy helper |
| `next_incident_number(p_company_id uuid)` |  | yes | **Revoke** (migration 20261021200000) | no callers found |
| `post_order_ack_status(p_shift_ids uuid[])` |  | yes | Keep | client rpc() |
| `remove_company_member(p_membership_id uuid)` |  | yes | Keep | client rpc() |
| `rotate_company_join_code(p_company_id uuid)` |  | yes | Keep | client rpc() |
| `set_company_default_rates(p_company_id uuid, p_pay_rate numeric, p_bill_rate numeric)` |  | yes | Keep | client rpc() |
| `set_company_overtime_config(p_company_id uuid, p_config jsonb)` |  | yes | Keep | client rpc() |
| `set_company_radio_state(p_company_id uuid, p_state text)` |  | yes | Keep | client rpc() |
| `set_member_pay_rate(p_membership_id uuid, p_pay_rate numeric)` |  | yes | Keep | client rpc() |
| `shares_company_with(p_user_id uuid)` |  | yes | Keep | RLS policy helper |
| `ships_in_bbox(p_south double precision, p_north double precision, p_west double precision, p_east double precision, p_limit integer)` |  | yes | Keep | client rpc() |
| `submit_intake_by_token(p_token text, p_client_name text, p_client_email text, p_data jsonb)` | yes | yes | Keep | client rpc(); anon: public client-intake submit |
| `timesheet_clock_in(p_company_id uuid, p_shift_id uuid, p_event_id uuid, p_type text, p_notes text, p_lat double precision, p_lng double precision, p_accuracy double precision, p_id uuid, p_client_at timestamp with time zone)` |  | yes | Keep | client rpc() |
| `timesheet_clock_out(p_id uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_client_at timestamp with time zone)` |  | yes | Keep | client rpc() |
| `training_can_manage_class(p_class_id uuid, p_company_id uuid)` |  | yes | Keep | RLS policy helper |
| `training_class_roster(p_class_id uuid)` |  | yes | Keep | client rpc() |
| `training_delete_course(p_course_id uuid)` |  | yes | Keep | client rpc() |
| `training_delete_quiz(p_quiz_id uuid)` |  | yes | Keep | client rpc() |
| `training_is_enrolled_in_class(p_class_id uuid)` |  | yes | Keep | RLS policy helper |
| `training_issue_certificate(p_company_id uuid, p_user_id uuid, p_name text, p_category text, p_state text, p_expiry date)` |  | yes | Keep | client rpc() |
| `training_learner_progress(p_company_id uuid, p_user_id uuid)` |  | yes | Keep | client rpc() |
| `training_list_learners(p_company_id uuid)` |  | yes | Keep | client rpc() |
| `update_member_admin_profile(p_membership_id uuid, p_user_fields jsonb, p_membership_fields jsonb)` |  | yes | Keep | client rpc() |
| `update_member_role(p_membership_id uuid, p_new_role text)` |  | yes | Keep | client rpc() |
| `user_belongs_to_company(p_company_id uuid)` |  | yes | **Revoke** (migration 20261021200000) | no callers found |

All kept functions check `auth.uid()` / company membership inside the function body (reviewed when each was added); the advisor flags any definer function callable by API roles, not a confirmed hole.

## pg_net in the public schema

`pg_net` 0.20 is not relocatable (`ALTER EXTENSION pg_net SET SCHEMA` is unsupported). Its functions already live in the `net` schema; only the extension record sits in `public`. Moving it means `DROP EXTENSION pg_net; CREATE EXTENSION pg_net WITH SCHEMA extensions;`, which drops queued/in-flight HTTP requests and the `net._http_response` history and needs re-granting on `net`. Cron job `intel-cctv-ingest` and `kick_notify_system()` call `net.http_post` and would keep working after re-create. **Not done in this PR**: do it in a quiet window with owner approval (see Supabase lint 0014 guidance), or accept the WARN.
