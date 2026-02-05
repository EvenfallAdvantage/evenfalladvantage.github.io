-- =====================================================
-- ADVANCED SURVEILLANCE & STALKING RECOGNITION COURSE
-- SIMPLIFIED VERSION FOR EASY DEPLOYMENT
-- =====================================================
-- Run this file first to create the course
-- Then run the module files to add content
-- =====================================================

-- Step 1: Create the course
INSERT INTO courses (
    course_name,
    course_code,
    description,
    short_description,
    duration_hours,
    difficulty_level,
    icon,
    is_active,
    display_order
) VALUES (
    'Advanced Surveillance & Stalking Recognition',
    'surveillance-detection',
    'Master the art of detecting physical surveillance, technical monitoring, and stalking behaviors. This comprehensive course covers surveillance detection routes (SDRs), pre-attack indicators, cyber stalking, OPSEC principles, and legal reporting procedures. Designed for both security professionals and civilians concerned about personal safety.',
    'Comprehensive training on recognizing and responding to surveillance and stalking behaviors',
    14,
    'Intermediate',
    'fa-eye',
    true,
    3
);

-- Note: After running this, you can run the individual module SQL files
-- The modules will automatically link to this course using the course_code 'surveillance-detection'
