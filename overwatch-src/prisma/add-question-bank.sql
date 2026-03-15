-- ============================================================
-- OVERWATCH — Assessment Question Bank
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── ASSESSMENT QUESTIONS (reusable question bank) ────
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

-- ─── RLS ──────────────────────────────────────────────

ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;

-- Company members can read questions
CREATE POLICY "aq_select" ON assessment_questions
  FOR SELECT TO authenticated
  USING (is_company_member(company_id));

-- Only admins can create/edit/delete questions
CREATE POLICY "aq_insert" ON assessment_questions
  FOR INSERT TO authenticated
  WITH CHECK (is_company_admin(company_id));

CREATE POLICY "aq_update" ON assessment_questions
  FOR UPDATE TO authenticated
  USING (is_company_admin(company_id));

CREATE POLICY "aq_delete" ON assessment_questions
  FOR DELETE TO authenticated
  USING (is_company_admin(company_id));

-- ─── ENRICH QUIZ_ATTEMPTS ─────────────────────────────
-- Add state_code for state-specific assessments (Module 7 Use of Force)
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS state_code TEXT;

-- ============================================================
-- ✅ Question bank table + RLS + quiz_attempts.state_code added
-- ============================================================
