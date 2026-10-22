-- EADB rolled-back verification: runs checks BEFORE, applies the migration, runs checks AFTER, then RAISEs (nothing commits).
DO $$
DECLARE a uuid:='22ce9c38-94bd-4e91-a367-1ee9c79c6459'; b uuid:='692e40b7-f519-4a5b-8786-adb56e61ffa7';
 s uuid:='23692a63-2115-447a-b573-d96c5557cf42'; s2 uuid:='394f0226-72a4-4ba2-8904-459c217bb2fa'; ca uuid:=gen_random_uuid(); cb uuid:=gen_random_uuid();
 ea uuid:=gen_random_uuid(); eb uuid:=gen_random_uuid(); ka uuid:=gen_random_uuid(); kb uuid:=gen_random_uuid(); n int; r text:='';
BEGIN
 IF public.is_admin(a) OR public.is_admin(b) THEN RAISE EXCEPTION 'test instructor is admin'; END IF;
 INSERT INTO scheduled_classes(id,instructor_id,class_name,class_type,scheduled_date,start_time,end_time) VALUES
  (ca,a,'ZZTEST A','zztest',current_date,'09:00','10:00'),(cb,b,'ZZTEST B','zztest',current_date,'09:00','10:00');
 INSERT INTO class_enrollments(id,class_id,student_id) VALUES (ea,ca,s),(eb,cb,s);
 INSERT INTO certificates(id,student_id,issued_by,certificate_number,certificate_type,certificate_name) VALUES
  (ka,s,a,'ZZ-A','zztest','ZZTEST'),(kb,s,b,'ZZ-B','zztest','ZZTEST');
 PERFORM set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
 PERFORM set_config('role','authenticated', true);
 UPDATE class_enrollments SET student_id=s WHERE id=eb; GET DIAGNOSTICS n=ROW_COUNT; r:=r||'upd_other_enr='||n;
 UPDATE class_enrollments SET student_id=s WHERE id=ea; GET DIAGNOSTICS n=ROW_COUNT; r:=r||' upd_own_enr='||n;
 BEGIN INSERT INTO class_enrollments(class_id,student_id) VALUES (cb,s2); r:=r||' ins_other_enr=ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN r:=r||' ins_other_enr=DENIED'; END;
 BEGIN INSERT INTO class_enrollments(class_id,student_id) VALUES (ca,s2); r:=r||' ins_own_enr=ALLOWED'; EXCEPTION WHEN others THEN r:=r||' ins_own_enr=ERR '||sqlstate; END;
 BEGIN UPDATE class_enrollments SET class_id=cb WHERE id=ea; GET DIAGNOSTICS n=ROW_COUNT; r:=r||' move_own_to_other='||n; EXCEPTION WHEN insufficient_privilege THEN r:=r||' move_own_to_other=DENIED'; END;
 UPDATE certificates SET revoked_by=a WHERE id=kb; GET DIAGNOSTICS n=ROW_COUNT; r:=r||' revoke_other_cert='||n;
 UPDATE certificates SET revoked_by=a WHERE id=ka; GET DIAGNOSTICS n=ROW_COUNT; r:=r||' revoke_own_cert='||n;
 BEGIN UPDATE certificates SET issued_by=b WHERE id=ka; GET DIAGNOSTICS n=ROW_COUNT; r:=r||' reassign_issuer='||n; EXCEPTION WHEN insufficient_privilege THEN r:=r||' reassign_issuer=DENIED'; END;
 DELETE FROM class_enrollments WHERE id=eb; GET DIAGNOSTICS n=ROW_COUNT; r:=r||' del_other_enr='||n;
 DELETE FROM class_enrollments WHERE id=ea; GET DIAGNOSTICS n=ROW_COUNT; r:=r||' del_own_enr='||n;
 PERFORM set_config('role','postgres', true);
 RAISE NOTICE '%', r; CREATE TEMP TABLE IF NOT EXISTS zz_r(t text); INSERT INTO zz_r VALUES (r);
 DELETE FROM certificates WHERE id IN (ka,kb); DELETE FROM scheduled_classes WHERE id IN (ca,cb);
END $$;
-- EADB: scope instructor writes on class_enrollments / certificates to classes
-- the instructor owns (scheduled_classes.instructor_id = auth.uid()).
-- Previously ANY active instructor could insert/update/delete ANY enrollment and
-- revoke ANY certificate. Admins (public.administrators) keep full write access.
DROP POLICY IF EXISTS "Instructors can insert enrollments" ON public.class_enrollments;
DROP POLICY IF EXISTS "Instructors can update enrollments" ON public.class_enrollments;
DROP POLICY IF EXISTS "Instructors can delete enrollments" ON public.class_enrollments;
DROP POLICY IF EXISTS "Instructors can revoke certificates" ON public.certificates;

CREATE POLICY "Instructors insert enrollments in own classes" ON public.class_enrollments
  FOR INSERT TO authenticated
  WITH CHECK (public.eadb_instructor_owns_class(class_id) OR public.is_admin((select auth.uid())));
CREATE POLICY "Instructors update enrollments in own classes" ON public.class_enrollments
  FOR UPDATE TO authenticated
  USING (public.eadb_instructor_owns_class(class_id) OR public.is_admin((select auth.uid())))
  WITH CHECK (public.eadb_instructor_owns_class(class_id) OR public.is_admin((select auth.uid())));
CREATE POLICY "Instructors delete enrollments in own classes" ON public.class_enrollments
  FOR DELETE TO authenticated
  USING (public.eadb_instructor_owns_class(class_id) OR public.is_admin((select auth.uid())));

-- Certificates: the issuing instructor (or an admin) may revoke/update; issued_by
-- cannot be reassigned to someone else by a non-admin.
CREATE POLICY "Issuer or admin can revoke certificates" ON public.certificates
  FOR UPDATE TO authenticated
  USING (issued_by = (select auth.uid()) OR public.is_admin((select auth.uid())))
  WITH CHECK (issued_by = (select auth.uid()) OR public.is_admin((select auth.uid())));
DO $$
DECLARE a uuid:='22ce9c38-94bd-4e91-a367-1ee9c79c6459'; b uuid:='692e40b7-f519-4a5b-8786-adb56e61ffa7';
 s uuid:='23692a63-2115-447a-b573-d96c5557cf42'; s2 uuid:='394f0226-72a4-4ba2-8904-459c217bb2fa'; ca uuid:=gen_random_uuid(); cb uuid:=gen_random_uuid();
 ea uuid:=gen_random_uuid(); eb uuid:=gen_random_uuid(); ka uuid:=gen_random_uuid(); kb uuid:=gen_random_uuid(); n int; r text:='';
BEGIN
 IF public.is_admin(a) OR public.is_admin(b) THEN RAISE EXCEPTION 'test instructor is admin'; END IF;
 INSERT INTO scheduled_classes(id,instructor_id,class_name,class_type,scheduled_date,start_time,end_time) VALUES
  (ca,a,'ZZTEST A','zztest',current_date,'09:00','10:00'),(cb,b,'ZZTEST B','zztest',current_date,'09:00','10:00');
 INSERT INTO class_enrollments(id,class_id,student_id) VALUES (ea,ca,s),(eb,cb,s);
 INSERT INTO certificates(id,student_id,issued_by,certificate_number,certificate_type,certificate_name) VALUES
  (ka,s,a,'ZZ-A','zztest','ZZTEST'),(kb,s,b,'ZZ-B','zztest','ZZTEST');
 PERFORM set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
 PERFORM set_config('role','authenticated', true);
 UPDATE class_enrollments SET student_id=s WHERE id=eb; GET DIAGNOSTICS n=ROW_COUNT; r:=r||'upd_other_enr='||n;
 UPDATE class_enrollments SET student_id=s WHERE id=ea; GET DIAGNOSTICS n=ROW_COUNT; r:=r||' upd_own_enr='||n;
 BEGIN INSERT INTO class_enrollments(class_id,student_id) VALUES (cb,s2); r:=r||' ins_other_enr=ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN r:=r||' ins_other_enr=DENIED'; END;
 BEGIN INSERT INTO class_enrollments(class_id,student_id) VALUES (ca,s2); r:=r||' ins_own_enr=ALLOWED'; EXCEPTION WHEN others THEN r:=r||' ins_own_enr=ERR '||sqlstate; END;
 BEGIN UPDATE class_enrollments SET class_id=cb WHERE id=ea; GET DIAGNOSTICS n=ROW_COUNT; r:=r||' move_own_to_other='||n; EXCEPTION WHEN insufficient_privilege THEN r:=r||' move_own_to_other=DENIED'; END;
 UPDATE certificates SET revoked_by=a WHERE id=kb; GET DIAGNOSTICS n=ROW_COUNT; r:=r||' revoke_other_cert='||n;
 UPDATE certificates SET revoked_by=a WHERE id=ka; GET DIAGNOSTICS n=ROW_COUNT; r:=r||' revoke_own_cert='||n;
 BEGIN UPDATE certificates SET issued_by=b WHERE id=ka; GET DIAGNOSTICS n=ROW_COUNT; r:=r||' reassign_issuer='||n; EXCEPTION WHEN insufficient_privilege THEN r:=r||' reassign_issuer=DENIED'; END;
 DELETE FROM class_enrollments WHERE id=eb; GET DIAGNOSTICS n=ROW_COUNT; r:=r||' del_other_enr='||n;
 DELETE FROM class_enrollments WHERE id=ea; GET DIAGNOSTICS n=ROW_COUNT; r:=r||' del_own_enr='||n;
 PERFORM set_config('role','postgres', true);
 RAISE NOTICE '%', r; CREATE TEMP TABLE IF NOT EXISTS zz_r(t text); INSERT INTO zz_r VALUES (r);
 DELETE FROM certificates WHERE id IN (ka,kb); DELETE FROM scheduled_classes WHERE id IN (ca,cb);
END $$;
DO $$ BEGIN RAISE EXCEPTION 'RESULTS BEFORE: % || AFTER: %', (select t from zz_r limit 1),(select t from zz_r offset 1 limit 1); END $$;
