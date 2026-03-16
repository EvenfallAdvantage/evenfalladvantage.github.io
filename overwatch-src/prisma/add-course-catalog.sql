-- ============================================================
-- Add catalog columns to courses table
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add missing catalog columns
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS duration_hours NUMERIC(5,1) DEFAULT 1;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS difficulty_level TEXT DEFAULT 'beginner';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_name TEXT;

-- Index for catalog queries
CREATE INDEX IF NOT EXISTS idx_courses_active ON courses(is_active, display_order);

-- ============================================================
-- SEED: Evenfall Advantage Course Catalog
-- Auto-finds company_id by name. If your company has a different
-- name, change the LIKE pattern below.
-- ============================================================

DO $$
DECLARE
  cid UUID;
BEGIN
  SELECT id INTO cid FROM companies WHERE name ILIKE '%Evenfall%' LIMIT 1;
  IF cid IS NULL THEN
    RAISE NOTICE 'No company matching "Evenfall" found. Skipping seed.';
    RETURN;
  END IF;

  -- Florida Class D — Unarmed Security Officer
  INSERT INTO courses (company_id, title, description, price, duration_hours, difficulty_level, is_required, passing_score, is_active, display_order)
  VALUES (cid,
    'Florida Class D — Unarmed Security Officer',
    'State-required 40-hour unarmed security officer training. Covers legal authority, access control, emergency response, report writing, observation techniques, and professional conduct. Required for Florida DOACS Class D license.',
    249.00, 40, 'beginner', true, 70, true, 1
  ) ON CONFLICT DO NOTHING;

  -- Florida Class G — Armed Security Officer
  INSERT INTO courses (company_id, title, description, price, duration_hours, difficulty_level, is_required, passing_score, is_active, display_order)
  VALUES (cid,
    'Florida Class G — Armed Security Officer',
    'State-required 28-hour firearms training for armed security officers. Covers firearms safety, marksmanship fundamentals, legal use of force, range qualification, and weapons retention. Prerequisite: Class D license.',
    399.00, 28, 'advanced', true, 80, true, 2
  ) ON CONFLICT DO NOTHING;

  -- De-Escalation & Conflict Resolution
  INSERT INTO courses (company_id, title, description, price, duration_hours, difficulty_level, is_required, passing_score, is_active, display_order)
  VALUES (cid,
    'De-Escalation & Conflict Resolution',
    'Verbal intervention techniques, crisis communication, behavioral threat indicators, and tactical de-escalation. Includes scenario-based exercises for real-world security encounters.',
    149.00, 8, 'intermediate', false, 70, true, 3
  ) ON CONFLICT DO NOTHING;

  -- Executive Protection Fundamentals
  INSERT INTO courses (company_id, title, description, price, duration_hours, difficulty_level, is_required, passing_score, is_active, display_order)
  VALUES (cid,
    'Executive Protection Fundamentals',
    'Introduction to close protection operations: advance work, threat assessment, motorcade procedures, principal movement, surveillance detection routes (SDRs), and protective intelligence.',
    599.00, 24, 'advanced', false, 80, true, 4
  ) ON CONFLICT DO NOTHING;

  -- Patrol Operations & Site Security
  INSERT INTO courses (company_id, title, description, price, duration_hours, difficulty_level, is_required, passing_score, is_active, display_order)
  VALUES (cid,
    'Patrol Operations & Site Security',
    'Comprehensive patrol tactics, perimeter security, checkpoint management, access control systems, CCTV monitoring, alarm response, and incident documentation best practices.',
    199.00, 16, 'beginner', false, 70, true, 5
  ) ON CONFLICT DO NOTHING;

  -- Use of Force & Legal Authority
  INSERT INTO courses (company_id, title, description, price, duration_hours, difficulty_level, is_required, passing_score, is_active, display_order)
  VALUES (cid,
    'Use of Force & Legal Authority',
    'Legal framework for security officers: Florida Statute 493, citizens arrest, trespass enforcement, use-of-force continuum, liability, documentation, and courtroom testimony preparation.',
    179.00, 12, 'intermediate', true, 80, true, 6
  ) ON CONFLICT DO NOTHING;

  -- Emergency Response & Crisis Management
  INSERT INTO courses (company_id, title, description, price, duration_hours, difficulty_level, is_required, passing_score, is_active, display_order)
  VALUES (cid,
    'Emergency Response & Crisis Management',
    'Active threat response, evacuation procedures, bomb threat protocols, fire safety, natural disaster response, mass casualty triage (START), and emergency action plan development.',
    229.00, 16, 'intermediate', false, 75, true, 7
  ) ON CONFLICT DO NOTHING;

  -- First Aid, CPR & AED Certification
  INSERT INTO courses (company_id, title, description, price, duration_hours, difficulty_level, is_required, passing_score, is_active, display_order)
  VALUES (cid,
    'First Aid, CPR & AED Certification',
    'American Heart Association-aligned first aid, CPR, and AED certification. Includes hands-on practice with manikins and AED trainers. Certificate valid for 2 years. Online portion only — practical exam with instructor required.',
    89.00, 6, 'beginner', false, 80, true, 8
  ) ON CONFLICT DO NOTHING;

  -- Surveillance & Counter-Surveillance
  INSERT INTO courses (company_id, title, description, price, duration_hours, difficulty_level, is_required, passing_score, is_active, display_order)
  VALUES (cid,
    'Surveillance & Counter-Surveillance',
    'Static and mobile surveillance techniques, counter-surveillance detection, photography/documentation, vehicle follows, and electronic surveillance awareness for security professionals.',
    349.00, 20, 'advanced', false, 75, true, 9
  ) ON CONFLICT DO NOTHING;

  -- Report Writing for Security Professionals
  INSERT INTO courses (company_id, title, description, price, duration_hours, difficulty_level, is_required, passing_score, is_active, display_order)
  VALUES (cid,
    'Report Writing for Security Professionals',
    'Professional incident report writing: narrative structure, objective language, evidence documentation, chain of custody, digital reporting tools, and reports that stand up in court.',
    99.00, 4, 'beginner', false, 70, true, 10
  ) ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Inserted 10 courses for company %', cid;
END $$;

-- ============================================================
-- ✅ Done! Run add-course-catalog.sql in Supabase SQL Editor.
-- Columns added + 10 courses seeded for Evenfall Advantage.
-- ============================================================
