-- =====================================================
-- MANUALLY MARK SYSTEMA SCOUT MODULE 0 AS COMPLETE
-- =====================================================
-- This script manually marks Module 0 (Orientation) as complete
-- for a specific student - useful for testing/fixing completion issues
-- =====================================================

-- Replace 'YOUR_EMAIL@EXAMPLE.COM' with the actual student email
DO $$
DECLARE
    v_student_id UUID;
    v_module_id UUID;
BEGIN
    -- Get student ID (replace with your email)
    SELECT id INTO v_student_id 
    FROM students 
    WHERE email = 'YOUR_EMAIL@EXAMPLE.COM'; -- CHANGE THIS
    
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Student not found. Please update the email address in the script.';
    END IF;
    
    -- Get Module 0 ID
    SELECT id INTO v_module_id 
    FROM training_modules 
    WHERE module_code = 'systema-scout-orientation';
    
    IF v_module_id IS NULL THEN
        RAISE EXCEPTION 'Module not found.';
    END IF;
    
    -- Check if progress record exists
    IF EXISTS (
        SELECT 1 FROM student_module_progress 
        WHERE student_id = v_student_id 
        AND module_id = v_module_id
    ) THEN
        -- Update existing record
        UPDATE student_module_progress
        SET 
            progress_percentage = 100,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE student_id = v_student_id 
        AND module_id = v_module_id;
        
        RAISE NOTICE 'Updated existing progress record to completed';
    ELSE
        -- Insert new record
        INSERT INTO student_module_progress (
            student_id,
            module_id,
            progress_percentage,
            completed_at,
            started_at,
            updated_at
        ) VALUES (
            v_student_id,
            v_module_id,
            100,
            NOW(),
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Created new progress record as completed';
    END IF;
    
    RAISE NOTICE 'Module 0 marked as complete for student: %', v_student_id;
END $$;

-- Verify the completion
SELECT 
    s.email,
    tm.module_code,
    tm.module_name,
    smp.progress_percentage,
    smp.completed_at
FROM student_module_progress smp
JOIN students s ON smp.student_id = s.id
JOIN training_modules tm ON smp.module_id = tm.id
WHERE tm.module_code = 'systema-scout-orientation'
AND s.email = 'YOUR_EMAIL@EXAMPLE.COM'; -- CHANGE THIS
