-- Rollback: original public.handle_new_student() captured 2026-10-17 before fix_handle_new_student_noop
CREATE OR REPLACE FUNCTION public.handle_new_student()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO student_profiles (student_id) VALUES (NEW.id);
  RETURN NEW;
END;
$function$;
