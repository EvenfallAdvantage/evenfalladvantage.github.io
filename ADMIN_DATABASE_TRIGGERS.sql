-- Database Triggers for Admin User Creation
-- Run this in Supabase SQL Editor to enable automatic student/client record creation

-- ============================================
-- STUDENT AUTO-CREATION TRIGGER
-- ============================================

-- Function to handle new student signups
CREATE OR REPLACE FUNCTION handle_new_student()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is a student signup
  IF NEW.raw_user_meta_data->>'user_type' = 'student' THEN
    -- Insert into students table
    INSERT INTO students (id, email, first_name, last_name, created_at)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'Unknown'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Also create empty profile
    INSERT INTO student_profiles (student_id, created_at)
    VALUES (NEW.id, NOW())
    ON CONFLICT (student_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created_student ON auth.users;
CREATE TRIGGER on_auth_user_created_student
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION handle_new_student();

-- ============================================
-- CLIENT AUTO-CREATION TRIGGER
-- ============================================

-- Function to handle new client signups
CREATE OR REPLACE FUNCTION handle_new_client()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is a client signup
  IF NEW.raw_user_meta_data->>'user_type' = 'client' THEN
    -- Insert into clients table
    INSERT INTO clients (
      id, 
      email, 
      first_name, 
      last_name, 
      company_name,
      phone,
      created_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'Unknown'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
      COALESCE(NEW.raw_user_meta_data->>'company_name', 'Unknown Company'),
      NEW.raw_user_meta_data->>'phone',
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created_client ON auth.users;
CREATE TRIGGER on_auth_user_created_client
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION handle_new_client();

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Database triggers created successfully!' as status;

-- Test the triggers by checking if they exist
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name IN ('on_auth_user_created_student', 'on_auth_user_created_client');

-- ============================================
-- NOTES
-- ============================================

-- These triggers will automatically:
-- 1. Create student/client records when users sign up via admin dashboard
-- 2. Extract metadata from signup (first_name, last_name, etc.)
-- 3. Handle conflicts gracefully (won't duplicate if record exists)
-- 4. Use SECURITY DEFINER to bypass RLS policies

-- After running this, test by creating a new student/client in admin dashboard
-- The record should appear immediately in the respective table
