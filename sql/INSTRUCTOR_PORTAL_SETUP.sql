-- =====================================================
-- INSTRUCTOR PORTAL DATABASE SETUP
-- =====================================================
-- This script creates all necessary tables for the Instructor Portal
-- Run this in your Supabase SQL Editor

-- =====================================================
-- 1. INSTRUCTORS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS instructors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    specialization TEXT[], -- Array of specializations (e.g., 'ICS', 'STOP THE BLEED', 'Unarmed Guard')
    bio TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- 2. SCHEDULED CLASSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS scheduled_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instructor_id UUID REFERENCES instructors(id) ON DELETE SET NULL,
    class_name TEXT NOT NULL,
    class_type TEXT NOT NULL, -- 'review', 'scenario', 'proctored_exam', 'training'
    scheduled_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_hours DECIMAL(3,1) DEFAULT 2.0, -- Default 2 hours
    capacity INTEGER DEFAULT 20,
    location TEXT,
    description TEXT,
    meeting_link TEXT, -- For virtual classes (Daily.co or other)
    status TEXT DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'completed', 'cancelled'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. CLASS ENROLLMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS class_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES scheduled_classes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    enrollment_status TEXT DEFAULT 'enrolled', -- 'enrolled', 'waitlist', 'dropped', 'completed'
    UNIQUE(class_id, student_id) -- Prevent duplicate enrollments
);

-- =====================================================
-- 4. CLASS ATTENDANCE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS class_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES scheduled_classes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    attendance_status TEXT DEFAULT 'present', -- 'present', 'absent', 'excused', 'late'
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    marked_by UUID REFERENCES instructors(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(class_id, student_id) -- One attendance record per student per class
);

-- =====================================================
-- 5. CERTIFICATES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_number TEXT UNIQUE NOT NULL, -- Format: EA-UG-YYYY-NNNN
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    issued_by UUID REFERENCES instructors(id),
    certificate_type TEXT NOT NULL, -- 'unarmed_guard', 'ics100', 'stop_the_bleed', etc.
    certificate_name TEXT NOT NULL, -- Display name
    state_issued TEXT, -- For state-specific certifications
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE,
    status TEXT DEFAULT 'active', -- 'active', 'revoked', 'expired'
    revocation_reason TEXT,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES instructors(id),
    pdf_url TEXT, -- URL to the generated PDF certificate
    verification_code TEXT UNIQUE, -- For external verification
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. INSTRUCTOR NOTES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS instructor_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instructor_id UUID REFERENCES instructors(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES scheduled_classes(id) ON DELETE SET NULL,
    note_type TEXT DEFAULT 'general', -- 'general', 'performance', 'behavioral', 'achievement'
    note_content TEXT NOT NULL,
    is_private BOOLEAN DEFAULT true, -- If false, student can see it
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 7. CERTIFICATE PREREQUISITES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS certificate_prerequisites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_type TEXT NOT NULL,
    prerequisite_type TEXT NOT NULL, -- 'module', 'assessment', 'attendance', 'class'
    prerequisite_value TEXT NOT NULL, -- Module ID, Assessment ID, or required count
    description TEXT,
    is_required BOOLEAN DEFAULT true
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_scheduled_classes_instructor ON scheduled_classes(instructor_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_classes_date ON scheduled_classes(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_classes_status ON scheduled_classes(status);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student ON class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class ON class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_attendance_student ON class_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_class_attendance_class ON class_attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_number ON certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_instructor_notes_student ON instructor_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_instructor_notes_instructor ON instructor_notes(instructor_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_prerequisites ENABLE ROW LEVEL SECURITY;

-- Instructors can view and edit their own data
CREATE POLICY "Instructors can view own profile" ON instructors
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Instructors can update own profile" ON instructors
    FOR UPDATE USING (auth.uid() = id);

-- Instructors can view all active instructors (for collaboration)
CREATE POLICY "View active instructors" ON instructors
    FOR SELECT USING (is_active = true);

-- Instructors can manage their scheduled classes
CREATE POLICY "Instructors can view their classes" ON scheduled_classes
    FOR SELECT USING (auth.uid() = instructor_id);

CREATE POLICY "Instructors can create classes" ON scheduled_classes
    FOR INSERT WITH CHECK (auth.uid() = instructor_id);

CREATE POLICY "Instructors can update their classes" ON scheduled_classes
    FOR UPDATE USING (auth.uid() = instructor_id);

CREATE POLICY "Instructors can delete their classes" ON scheduled_classes
    FOR DELETE USING (auth.uid() = instructor_id);

-- Students can view classes they're enrolled in
CREATE POLICY "Students can view their enrolled classes" ON scheduled_classes
    FOR SELECT USING (
        id IN (
            SELECT class_id FROM class_enrollments 
            WHERE student_id = auth.uid()
        )
    );

-- Instructors can manage enrollments for their classes
CREATE POLICY "Instructors can manage enrollments" ON class_enrollments
    FOR ALL USING (
        class_id IN (
            SELECT id FROM scheduled_classes 
            WHERE instructor_id = auth.uid()
        )
    );

-- Students can view their own enrollments
CREATE POLICY "Students can view own enrollments" ON class_enrollments
    FOR SELECT USING (auth.uid() = student_id);

-- Instructors can manage attendance for their classes
CREATE POLICY "Instructors can manage attendance" ON class_attendance
    FOR ALL USING (
        class_id IN (
            SELECT id FROM scheduled_classes 
            WHERE instructor_id = auth.uid()
        )
    );

-- Students can view their own attendance
CREATE POLICY "Students can view own attendance" ON class_attendance
    FOR SELECT USING (auth.uid() = student_id);

-- Instructors can issue and manage certificates
CREATE POLICY "Instructors can issue certificates" ON certificates
    FOR INSERT WITH CHECK (auth.uid() = issued_by);

CREATE POLICY "Instructors can view all certificates" ON certificates
    FOR SELECT USING (
        auth.uid() IN (SELECT id FROM instructors)
    );

CREATE POLICY "Instructors can revoke certificates" ON certificates
    FOR UPDATE USING (
        auth.uid() IN (SELECT id FROM instructors)
    );

-- Students can view their own certificates
CREATE POLICY "Students can view own certificates" ON certificates
    FOR SELECT USING (auth.uid() = student_id);

-- Instructors can manage their notes
CREATE POLICY "Instructors can manage their notes" ON instructor_notes
    FOR ALL USING (auth.uid() = instructor_id);

-- Students can view non-private notes about themselves
CREATE POLICY "Students can view public notes about them" ON instructor_notes
    FOR SELECT USING (
        auth.uid() = student_id AND is_private = false
    );

-- Everyone can view certificate prerequisites
CREATE POLICY "Anyone can view prerequisites" ON certificate_prerequisites
    FOR SELECT USING (true);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_instructors_updated_at BEFORE UPDATE ON instructors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_classes_updated_at BEFORE UPDATE ON scheduled_classes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_instructor_notes_updated_at BEFORE UPDATE ON instructor_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTIONS FOR CERTIFICATE NUMBER GENERATION
-- =====================================================

CREATE OR REPLACE FUNCTION generate_certificate_number(cert_type TEXT)
RETURNS TEXT AS $$
DECLARE
    prefix TEXT;
    year TEXT;
    sequence_num INTEGER;
    cert_number TEXT;
BEGIN
    -- Determine prefix based on certificate type
    prefix := CASE cert_type
        WHEN 'unarmed_guard' THEN 'EA-UG'
        WHEN 'ics100' THEN 'EA-ICS'
        WHEN 'stop_the_bleed' THEN 'EA-STB'
        ELSE 'EA-CERT'
    END;
    
    -- Get current year
    year := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    -- Get next sequence number for this year
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(certificate_number FROM '[0-9]+$') AS INTEGER)
    ), 0) + 1
    INTO sequence_num
    FROM certificates
    WHERE certificate_number LIKE prefix || '-' || year || '-%';
    
    -- Format: EA-UG-2025-0001
    cert_number := prefix || '-' || year || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN cert_number;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INSERT DEFAULT CERTIFICATE PREREQUISITES
-- =====================================================

-- Unarmed Guard Certificate Prerequisites
INSERT INTO certificate_prerequisites (certificate_type, prerequisite_type, prerequisite_value, description) VALUES
('unarmed_guard', 'module', '1', 'Module 1: Communication Protocols - Must be completed'),
('unarmed_guard', 'module', '2', 'Module 2: Emergency Response - Must be completed'),
('unarmed_guard', 'module', '3', 'Module 3: Crowd Management - Must be completed'),
('unarmed_guard', 'module', '4', 'Module 4: Crime Scene Preservation - Must be completed'),
('unarmed_guard', 'module', '5', 'Module 5: Legal Authority & Use of Force - Must be completed'),
('unarmed_guard', 'module', '6', 'Module 6: Report Writing & Documentation - Must be completed'),
('unarmed_guard', 'module', '7', 'Module 7: State-Specific Laws - Must pass for at least one state'),
('unarmed_guard', 'assessment', 'comprehensive', 'Must pass comprehensive assessment with 80% or higher'),
('unarmed_guard', 'attendance', '2', 'Must attend at least 2 proctored classes')
ON CONFLICT DO NOTHING;

-- =====================================================
-- CREATE DEFAULT INSTRUCTOR ACCOUNT (Optional)
-- =====================================================
-- Note: You'll need to manually create the auth user in Supabase Auth first,
-- then insert the instructor record with the same UUID

-- Example:
-- INSERT INTO instructors (id, email, first_name, last_name, specialization) VALUES
-- ('YOUR-AUTH-USER-UUID', 'instructor@evenfalladvantage.com', 'John', 'Instructor', ARRAY['unarmed_guard', 'ics100']);

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================
-- Next steps:
-- 1. Create an instructor account in Supabase Auth
-- 2. Add the instructor record using their auth UUID
-- 3. Test the instructor portal login
