-- EADB (vaagvairvwmgyzsmymhs): make handle_new_student() a no-op.
--
-- The trigger on_auth_user_created_student (AFTER INSERT ON auth.users) ran
-- for EVERY new auth user and inserted student_profiles(student_id) before
-- any students row existed. student_profiles.student_id has an FK to
-- students(id), so every signup / auth.admin.createUser failed with 23503
-- ("Database error creating new user"). No account has been created since
-- 2026-01-17.
--
-- create-student (the admin path) already inserts the students row and then
-- the student_profiles row itself, so the trigger is not needed.
CREATE OR REPLACE FUNCTION public.handle_new_student()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN NEW;
END;
$function$;
