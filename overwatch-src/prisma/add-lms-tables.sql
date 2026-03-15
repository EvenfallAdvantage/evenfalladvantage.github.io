-- ============================================================
-- OVERWATCH LMS — Training Modules, Slides & Progress
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── TRAINING MODULES ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_modules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_code     TEXT NOT NULL,
  module_name     TEXT NOT NULL,
  description     TEXT,
  icon            TEXT DEFAULT 'fa-graduation-cap',
  duration_minutes INT DEFAULT 60,
  difficulty_level TEXT DEFAULT 'Intermediate'
    CHECK (difficulty_level IN ('Beginner', 'Intermediate', 'Advanced', 'Critical', 'Essential')),
  is_required     BOOLEAN DEFAULT false,
  is_active       BOOLEAN DEFAULT true,
  display_order   INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, module_code)
);

CREATE INDEX IF NOT EXISTS idx_training_modules_company ON training_modules(company_id);
CREATE INDEX IF NOT EXISTS idx_training_modules_code ON training_modules(module_code);
CREATE INDEX IF NOT EXISTS idx_training_modules_order ON training_modules(company_id, display_order);

-- ─── MODULE SLIDES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_slides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id       UUID NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content_html    TEXT NOT NULL DEFAULT '',
  audio_url       TEXT,
  image_url       TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_slides_module ON module_slides(module_id, sort_order);

-- ─── STUDENT MODULE PROGRESS ──────────────────────────────
CREATE TABLE IF NOT EXISTS student_module_progress (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id           UUID NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  status              TEXT DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_percentage INT DEFAULT 0
    CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  current_slide       INT DEFAULT 0,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  last_accessed_at    TIMESTAMPTZ DEFAULT now(),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_smp_user ON student_module_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_smp_module ON student_module_progress(module_id);
CREATE INDEX IF NOT EXISTS idx_smp_status ON student_module_progress(status);

-- ─── LINK QUIZZES TO MODULES ──────────────────────────────
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES training_modules(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quizzes_module ON quizzes(module_id);

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_module_progress ENABLE ROW LEVEL SECURITY;

-- Training modules: company members can read; admins can write
CREATE POLICY "training_modules_select" ON training_modules
  FOR SELECT TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "training_modules_insert" ON training_modules
  FOR INSERT TO authenticated
  WITH CHECK (is_company_admin(company_id));

CREATE POLICY "training_modules_update" ON training_modules
  FOR UPDATE TO authenticated
  USING (is_company_admin(company_id));

CREATE POLICY "training_modules_delete" ON training_modules
  FOR DELETE TO authenticated
  USING (is_company_admin(company_id));

-- Module slides: anyone who can see the module can see its slides
CREATE POLICY "module_slides_select" ON module_slides
  FOR SELECT TO authenticated
  USING (
    module_id IN (
      SELECT id FROM training_modules WHERE is_company_member(company_id)
    )
  );

CREATE POLICY "module_slides_insert" ON module_slides
  FOR INSERT TO authenticated
  WITH CHECK (
    module_id IN (
      SELECT id FROM training_modules WHERE is_company_admin(company_id)
    )
  );

CREATE POLICY "module_slides_update" ON module_slides
  FOR UPDATE TO authenticated
  USING (
    module_id IN (
      SELECT id FROM training_modules WHERE is_company_admin(company_id)
    )
  );

CREATE POLICY "module_slides_delete" ON module_slides
  FOR DELETE TO authenticated
  USING (
    module_id IN (
      SELECT id FROM training_modules WHERE is_company_admin(company_id)
    )
  );

-- Student module progress: users manage their own
CREATE POLICY "smp_select" ON student_module_progress
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));

CREATE POLICY "smp_insert" ON student_module_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));

CREATE POLICY "smp_update" ON student_module_progress
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));

CREATE POLICY "smp_delete" ON student_module_progress
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));

-- ============================================================
-- ✅ LMS tables created: training_modules, module_slides,
--    student_module_progress + quizzes.module_id + RLS
-- ============================================================
