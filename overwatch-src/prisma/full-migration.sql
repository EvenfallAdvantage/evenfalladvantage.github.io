-- ============================================================
-- OVERWATCH FULL DATABASE MIGRATION
-- Run ONCE in: Supabase Dashboard - SQL Editor - New Query
-- Combines: LMS tables, Question Bank, Phase 4 Payments/Certs
-- ============================================================

-- PART 1: LMS - Training Modules, Slides and Progress

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

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES training_modules(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quizzes_module ON quizzes(module_id);

-- LMS RLS
ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_module_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_modules_select" ON training_modules FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "training_modules_insert" ON training_modules FOR INSERT TO authenticated WITH CHECK (is_company_admin(company_id));
CREATE POLICY "training_modules_update" ON training_modules FOR UPDATE TO authenticated USING (is_company_admin(company_id));
CREATE POLICY "training_modules_delete" ON training_modules FOR DELETE TO authenticated USING (is_company_admin(company_id));

CREATE POLICY "module_slides_select" ON module_slides FOR SELECT TO authenticated USING (module_id IN (SELECT id FROM training_modules WHERE is_company_member(company_id)));
CREATE POLICY "module_slides_insert" ON module_slides FOR INSERT TO authenticated WITH CHECK (module_id IN (SELECT id FROM training_modules WHERE is_company_admin(company_id)));
CREATE POLICY "module_slides_update" ON module_slides FOR UPDATE TO authenticated USING (module_id IN (SELECT id FROM training_modules WHERE is_company_admin(company_id)));
CREATE POLICY "module_slides_delete" ON module_slides FOR DELETE TO authenticated USING (module_id IN (SELECT id FROM training_modules WHERE is_company_admin(company_id)));

CREATE POLICY "smp_select" ON student_module_progress FOR SELECT TO authenticated USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));
CREATE POLICY "smp_insert" ON student_module_progress FOR INSERT TO authenticated WITH CHECK (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));
CREATE POLICY "smp_update" ON student_module_progress FOR UPDATE TO authenticated USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));
CREATE POLICY "smp_delete" ON student_module_progress FOR DELETE TO authenticated USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));


-- PART 2: Assessment Question Bank

CREATE TABLE IF NOT EXISTS assessment_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id       UUID REFERENCES training_modules(id) ON DELETE SET NULL,
  question_text   TEXT NOT NULL,
  question_type   TEXT DEFAULT 'multiple_choice'
    CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer')),
  options         JSONB DEFAULT '[]',
  correct_answer  TEXT NOT NULL,
  explanation     TEXT,
  difficulty      TEXT DEFAULT 'medium'
    CHECK (difficulty IN ('easy', 'medium', 'hard')),
  category        TEXT,
  tags            TEXT[] DEFAULT '{}',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aq_company ON assessment_questions(company_id);
CREATE INDEX IF NOT EXISTS idx_aq_module ON assessment_questions(module_id);
CREATE INDEX IF NOT EXISTS idx_aq_category ON assessment_questions(company_id, category);
CREATE INDEX IF NOT EXISTS idx_aq_difficulty ON assessment_questions(company_id, difficulty);

ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aq_select" ON assessment_questions FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "aq_insert" ON assessment_questions FOR INSERT TO authenticated WITH CHECK (is_company_admin(company_id));
CREATE POLICY "aq_update" ON assessment_questions FOR UPDATE TO authenticated USING (is_company_admin(company_id));
CREATE POLICY "aq_delete" ON assessment_questions FOR DELETE TO authenticated USING (is_company_admin(company_id));

ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS state_code TEXT;


-- PART 3: Payments and Certifications Enrichment

ALTER TABLE certifications
  ADD COLUMN IF NOT EXISTS certificate_number TEXT,
  ADD COLUMN IF NOT EXISTS issued_by TEXT,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS verification_code TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES training_modules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_certifications_company ON certifications(company_id);
CREATE INDEX IF NOT EXISTS idx_certifications_verification ON certifications(verification_code);
CREATE INDEX IF NOT EXISTS idx_certifications_category ON certifications(category);

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS duration_hours DECIMAL(5,1),
  ADD COLUMN IF NOT EXISTS difficulty_level TEXT DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending',
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_company ON payment_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe ON payment_transactions(stripe_payment_intent_id);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own payments" ON payment_transactions;
CREATE POLICY "Users view own payments" ON payment_transactions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own payments" ON payment_transactions;
CREATE POLICY "Users insert own payments" ON payment_transactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access payments" ON payment_transactions;
CREATE POLICY "Service role full access payments" ON payment_transactions
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Company admins manage certs" ON certifications;
CREATE POLICY "Company admins manage certs" ON certifications
  FOR ALL USING (
    user_id = auth.uid()
    OR company_id IN (
      SELECT company_id FROM company_memberships
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
      AND status = 'active'
    )
  );

-- ============================================================
-- MIGRATION COMPLETE
-- Tables created: training_modules, module_slides,
--   student_module_progress, assessment_questions,
--   payment_transactions
-- Tables enriched: certifications, courses, quizzes,
--   quiz_attempts
-- RLS policies applied to all new tables
-- ============================================================
