-- Staging Seed Data for Local Supabase
-- Run after all migrations to populate test data

-- Test Company
INSERT INTO companies (id, name, join_code, brand_color, accent_color, is_training_provider, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Staging Security Corp',
  'STAGE1',
  '#1d3451',
  '#d59b3c',
  true,
  now()
) ON CONFLICT (id) DO NOTHING;

-- Test Users (password: "staging12345!" for all)
-- Note: In local Supabase, auth users are created separately via the Auth UI
-- These are the application-level user records

INSERT INTO users (id, supabase_id, email, first_name, last_name, phone, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000010', 'staging-admin-uuid', 'admin@staging.local', 'Admin', 'User', '(555) 100-0001', now()),
  ('00000000-0000-0000-0000-000000000011', 'staging-manager-uuid', 'manager@staging.local', 'Manager', 'User', '(555) 100-0002', now()),
  ('00000000-0000-0000-0000-000000000012', 'staging-staff1-uuid', 'staff1@staging.local', 'Staff', 'Alpha', '(555) 100-0003', now()),
  ('00000000-0000-0000-0000-000000000013', 'staging-staff2-uuid', 'staff2@staging.local', 'Staff', 'Bravo', '(555) 100-0004', now())
ON CONFLICT (id) DO NOTHING;

-- Company Memberships
INSERT INTO company_memberships (id, user_id, company_id, role, status, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'manager', 'active', now()),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'staff', 'active', now()),
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'staff', 'active', now())
ON CONFLICT (id) DO NOTHING;

-- Test Event/Operation
INSERT INTO events (id, company_id, name, location, start_date, end_date, status, engagement_type, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000030',
  '00000000-0000-0000-0000-000000000001',
  'Staging Test Operation',
  '123 Test Ave, Phoenix, AZ 85001',
  now()::date,
  (now() + interval '7 days')::date,
  'published',
  'Event Security',
  now()
) ON CONFLICT (id) DO NOTHING;

-- Test Shifts
INSERT INTO shifts (id, event_id, start_time, end_time, role, capacity, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000030', now() + interval '1 day', now() + interval '1 day 8 hours', 'Guard', 2, now()),
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000030', now() + interval '2 days', now() + interval '2 days 8 hours', 'Guard', 2, now())
ON CONFLICT (id) DO NOTHING;

-- Test Chat Channel
INSERT INTO chat_channels (id, company_id, name, created_by, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000050',
  '00000000-0000-0000-0000-000000000001',
  'General',
  '00000000-0000-0000-0000-000000000010',
  now()
) ON CONFLICT (id) DO NOTHING;

-- Test Briefing Post
INSERT INTO posts (id, company_id, user_id, content, is_pinned, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000060',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'Welcome to the staging environment. This is a test briefing post.',
  true,
  now()
) ON CONFLICT (id) DO NOTHING;

-- Done
SELECT 'Staging seed data loaded successfully' AS status;
