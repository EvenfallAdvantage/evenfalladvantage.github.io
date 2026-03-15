# Client Portal - Final Setup Instructions

## ⚠️ Important: Rate Limit
You've hit Supabase's rate limit (429 errors). **Wait 10-15 minutes** before trying to create an account again.

## 🔧 Database Setup (Run in Supabase SQL Editor)

Run this SQL to fix the RLS policy issue:

```sql
-- Drop ALL existing policies on clients table
DROP POLICY IF EXISTS "Clients can view own profile" ON clients;
DROP POLICY IF EXISTS "Clients can insert own profile" ON clients;
DROP POLICY IF EXISTS "Clients can update own profile" ON clients;
DROP POLICY IF EXISTS "Allow client profile creation" ON clients;

-- Disable RLS temporarily to test
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Create new policies that work with signup flow
CREATE POLICY "Enable insert for authenticated users" ON clients
    FOR INSERT 
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable read access for own profile" ON clients
    FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Enable update for own profile" ON clients
    FOR UPDATE 
    USING (auth.uid() = id);
```

## 🎯 What This Does:

1. **Removes all conflicting policies**
2. **Allows ANY authenticated user to insert** (needed during signup)
3. **Restricts SELECT/UPDATE to own profile only**

## ✅ After Running SQL:

1. **Wait 10-15 minutes** for rate limit to reset
2. **Clear browser cache** (Ctrl+Shift+Delete)
3. **Try creating account again**

## 🐛 If Still Not Working:

Check in Supabase Dashboard:
1. Go to **Authentication** → **Policies**
2. Find `clients` table
3. Verify the policies match above
4. Check **Table Editor** → `clients` to see if any test records were created

## 📝 Alternative: Manual Test

1. Create a user in **Authentication** → **Users** → **Add User**
2. Get their UUID
3. Manually insert into `clients` table:
```sql
INSERT INTO clients (id, company_name, contact_name, email, phone)
VALUES ('USER_UUID_HERE', 'Test Company', 'Test User', 'test@test.com', '555-1234');
```

If manual insert works, the RLS policy is the issue.

## 🚀 Once Working:

Your client portal will have:
- ✅ Client registration
- ✅ Company profile management
- ✅ Job posting creation
- ✅ Candidate browsing
- ✅ Full dashboard

---

**Current Status:** Rate limited - wait 10-15 minutes before retry
