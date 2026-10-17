-- Rollback for 20261017184312_training_eadb_consolidation.sql.
-- Drops only objects that migration added. Run BEFORE any EADB data is copied, or after
-- deleting copied rows (`delete from <table> where eadb_id is not null`), because dropping
-- the eadb_id columns loses the back-references.
BEGIN;
DROP FUNCTION IF EXISTS public.admin_set_training_quiz_answer(uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_get_training_quiz_answers(uuid);
DROP FUNCTION IF EXISTS public.grade_training_quiz(uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.get_training_quiz(uuid);

DROP TABLE IF EXISTS public.training_quiz_answer_keys;
DROP TABLE IF EXISTS public.training_quiz_questions;
DROP TABLE IF EXISTS public.training_class_attendance;
DROP TABLE IF EXISTS public.training_class_enrollments;
DROP TABLE IF EXISTS public.training_classes;
DROP TABLE IF EXISTS public.state_laws;
DROP TABLE IF EXISTS public.certificate_prerequisites;
DROP TABLE IF EXISTS public.course_completion_requirements;
DROP TABLE IF EXISTS public.course_modules;

DROP FUNCTION IF EXISTS public.training_check_company();
DROP FUNCTION IF EXISTS public.training_touch_updated_at();

DROP INDEX IF EXISTS public.courses_eadb_id_key, public.training_modules_eadb_id_key, public.module_slides_eadb_id_key,
  public.quizzes_eadb_id_key, public.quiz_attempts_eadb_id_key, public.student_module_progress_eadb_id_key,
  public.course_enrollments_eadb_id_key, public.certifications_eadb_id_key, public.users_eadb_user_id_key,
  public.training_modules_default_course_id_idx;

ALTER TABLE public.company_memberships DROP COLUMN IF EXISTS training_profile;
ALTER TABLE public.users DROP COLUMN IF EXISTS eadb_user_id;
ALTER TABLE public.certifications DROP COLUMN IF EXISTS eadb_id;
ALTER TABLE public.course_enrollments DROP COLUMN IF EXISTS eadb_id, DROP COLUMN IF EXISTS enrollment_type,
  DROP COLUMN IF EXISTS expires_at, DROP COLUMN IF EXISTS last_accessed_at, DROP COLUMN IF EXISTS amount_paid,
  DROP COLUMN IF EXISTS currency, DROP COLUMN IF EXISTS payment_ref;
ALTER TABLE public.student_module_progress DROP COLUMN IF EXISTS eadb_id;
ALTER TABLE public.quiz_attempts DROP COLUMN IF EXISTS eadb_id, DROP COLUMN IF EXISTS time_taken_minutes;
ALTER TABLE public.quizzes DROP CONSTRAINT IF EXISTS quizzes_question_source_check;
ALTER TABLE public.quizzes DROP COLUMN IF EXISTS eadb_id, DROP COLUMN IF EXISTS category, DROP COLUMN IF EXISTS question_source;
ALTER TABLE public.module_slides DROP COLUMN IF EXISTS eadb_id, DROP COLUMN IF EXISTS slide_type,
  DROP COLUMN IF EXISTS video_url, DROP COLUMN IF EXISTS notes, DROP COLUMN IF EXISTS audio_autoplay;
ALTER TABLE public.training_modules DROP COLUMN IF EXISTS eadb_id, DROP COLUMN IF EXISTS estimated_time,
  DROP COLUMN IF EXISTS default_course_id;
ALTER TABLE public.courses DROP COLUMN IF EXISTS eadb_id, DROP COLUMN IF EXISTS course_code,
  DROP COLUMN IF EXISTS short_description, DROP COLUMN IF EXISTS is_featured, DROP COLUMN IF EXISTS icon,
  DROP COLUMN IF EXISTS prerequisites, DROP COLUMN IF EXISTS learning_objectives, DROP COLUMN IF EXISTS target_audience;

DROP FUNCTION IF EXISTS public.training_can_manage(uuid);
DROP FUNCTION IF EXISTS public.training_can_view(uuid);
COMMIT;
