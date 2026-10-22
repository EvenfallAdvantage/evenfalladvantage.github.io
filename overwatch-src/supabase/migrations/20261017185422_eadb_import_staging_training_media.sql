-- EADB retirement phase 3: import staging + training-media bucket (OverwatchDB).
-- eadb_import is NOT exposed through the API (not in the PostgREST schemas, and
-- no privileges for anon/authenticated). Drop it after the cutover.

CREATE SCHEMA IF NOT EXISTS eadb_import;
REVOKE ALL ON SCHEMA eadb_import FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS eadb_import.raw (
  tbl       text PRIMARY KEY,
  data      jsonb NOT NULL,
  rows      integer NOT NULL,
  md5       text NOT NULL,
  loaded_at timestamptz NOT NULL DEFAULT now()
);

-- EADB id -> Overwatch id, for everything the copy maps (created = row was inserted
-- by the copy; false = mapped onto a pre-existing Overwatch row, never deleted on undo).
CREATE TABLE IF NOT EXISTS eadb_import.id_map (
  entity  text NOT NULL,
  eadb_id uuid NOT NULL,
  ow_id   uuid NOT NULL,
  created boolean NOT NULL,
  note    text,
  PRIMARY KEY (entity, eadb_id)
);

-- One row per EADB person (by email): who they map to and what still has to happen
-- in phase 4 (invite / membership / profile).
CREATE TABLE IF NOT EXISTS eadb_import.people (
  email               text PRIMARY KEY,
  ow_user_id          uuid,
  placeholder_created boolean NOT NULL DEFAULT false,
  has_login           boolean,
  ef_role             text,
  eadb_roles          text[] NOT NULL DEFAULT '{}',
  eadb_ids            uuid[] NOT NULL DEFAULT '{}',
  profile             jsonb,
  is_test             boolean NOT NULL DEFAULT false,
  note                text
);

-- Storage objects to copy: EADB public object -> Overwatch bucket/path.
CREATE TABLE IF NOT EXISTS eadb_import.objects (
  src_bucket text NOT NULL,
  src_path   text NOT NULL,
  dst_bucket text NOT NULL,
  dst_path   text NOT NULL,
  size       bigint,
  mimetype   text,
  copied_at  timestamptz,
  PRIMARY KEY (src_bucket, src_path)
);

REVOKE ALL ON ALL TABLES IN SCHEMA eadb_import FROM PUBLIC, anon, authenticated;

-- Public bucket for training slide media (the EADB course-media bucket was public and
-- the slide viewer needs it). Writes: training managers of the company in the first
-- path segment.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('training-media', 'training-media', true, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "training-media: managers upload" ON storage.objects;
DROP POLICY IF EXISTS "training-media: managers update" ON storage.objects;
DROP POLICY IF EXISTS "training-media: managers delete" ON storage.objects;
CREATE POLICY "training-media: managers upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'training-media' AND public.training_can_manage(public.storage_path_company(name)));
CREATE POLICY "training-media: managers update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'training-media' AND public.training_can_manage(public.storage_path_company(name)))
  WITH CHECK (bucket_id = 'training-media' AND public.training_can_manage(public.storage_path_company(name)));
CREATE POLICY "training-media: managers delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'training-media' AND public.training_can_manage(public.storage_path_company(name)));
