# Admin Dashboard Troubleshooting

## Issue: Navigation buttons not working & Student count showing 0

### Quick Fix Steps:

1. **Run the RLS Policies SQL**
   - Open `ADMIN_RLS_POLICIES.sql` in Supabase SQL Editor
   - Execute the entire file
   - This gives admins permission to view all data

2. **Check Browser Console**
   - Press F12 to open Developer Tools
   - Go to Console tab
   - Look for errors (red text)
   - You should see:
     - "Setting up event listeners..."
     - "Found nav items: 6"
     - "Event listeners setup complete"

3. **Verify Admin Status**
   - In Supabase SQL Editor, run:
   ```sql
   SELECT * FROM administrators WHERE user_id = auth.uid();
   ```
   - Should return your admin record

4. **Check RLS Policies**
   - In Supabase SQL Editor, run:
   ```sql
   SELECT is_admin();
   ```
   - Should return `true`

### Common Issues:

#### Navigation Not Working
**Symptoms:** Clicking sidebar buttons does nothing

**Causes:**
- JavaScript error preventing event listeners from attaching
- CSS preventing clicks (z-index issue)

**Solutions:**
1. Check browser console for errors
2. Hard refresh page (Ctrl+Shift+R)
3. Clear browser cache
4. Check if console shows "Found nav items: 6"

#### Student Count Shows 0
**Symptoms:** Dashboard shows 0 students even though they exist

**Causes:**
- RLS policies blocking admin access
- Database query errors

**Solutions:**
1. **Run ADMIN_RLS_POLICIES.sql** (most common fix)
2. Check console for errors like "Error loading student count"
3. Verify students exist:
   ```sql
   SELECT COUNT(*) FROM students;
   ```
4. Test admin function:
   ```sql
   SELECT is_admin();
   ```

### Debug Checklist:

- [ ] Ran `ADMIN_SETUP.sql`
- [ ] Ran `ADMIN_RLS_POLICIES.sql`
- [ ] Ran `ADMIN_DATABASE_TRIGGERS.sql`
- [ ] Admin user exists in `administrators` table
- [ ] Browser console shows no errors
- [ ] Hard refreshed page (Ctrl+Shift+R)
- [ ] Logged out and back in

### SQL to Check Everything:

```sql
-- Check if you're an admin
SELECT 
  auth.uid() as my_user_id,
  is_admin() as am_i_admin;

-- Check admin record
SELECT * FROM administrators WHERE user_id = auth.uid();

-- Check student count
SELECT COUNT(*) as total_students FROM students;

-- Check if you can see students (should return rows if RLS is correct)
SELECT id, first_name, last_name FROM students LIMIT 5;

-- Check RLS policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('students', 'clients', 'certifications')
ORDER BY tablename;
```

### If Still Not Working:

1. **Check Supabase URL and Anon Key**
   - Verify `supabase-config.js` has correct credentials

2. **Check Network Tab**
   - F12 → Network tab
   - Look for failed requests (red)
   - Check response for error messages

3. **Re-create Admin User**
   ```sql
   -- Delete old admin record
   DELETE FROM administrators WHERE email = 'your@email.com';
   
   -- Re-insert
   INSERT INTO administrators (user_id, first_name, last_name, email)
   VALUES ('YOUR_USER_ID', 'Admin', 'User', 'your@email.com');
   ```

4. **Check Table Permissions**
   - Supabase Dashboard → Table Editor
   - Click on `students` table
   - Check if RLS is enabled
   - View policies

### Expected Console Output:

When dashboard loads successfully, you should see:
```
Setting up event listeners...
Found nav items: 6
Event listeners setup complete
```

When clicking navigation:
```
Nav clicked: students
Nav clicked: clients
Nav clicked: certificates
```

### Contact Points:

If errors appear in console, note:
- Error message
- Which function failed
- Network request status codes
- Any RLS policy errors
