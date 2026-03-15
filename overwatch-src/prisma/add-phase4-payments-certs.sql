-- ============================================================
-- OVERWATCH — Phase 4: Payments + Certifications Enrichment
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── 1. Enrich certifications table ───────────────────

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

-- ─── 2. Enrich courses table ──────────────────────────

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS duration_hours DECIMAL(5,1),
  ADD COLUMN IF NOT EXISTS difficulty_level TEXT DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ─── 3. Payment transactions table ────────────────────

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

-- ─── 4. RLS for payment_transactions ──────────────────

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

-- ─── 5. Certifications RLS for company admins ─────────

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
-- ✅ Certifications enriched, courses enriched,
--    payment_transactions created, RLS applied
-- ============================================================
