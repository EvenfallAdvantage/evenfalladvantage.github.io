# 🚀 Quick Start Guide - Supabase Integration

## Test Your Setup (5 Minutes)

### Step 1: Open Login Page
```
Open in browser: student-portal/login.html
```

### Step 2: Create Test Account
```
Click "Sign Up" tab
First Name: Test
Last Name: Student
Email: test@evenfalladvantage.com
Password: TestPassword123!
Click "Create Account"
```

### Step 3: Login
```
Click "Login" tab
Email: test@evenfalladvantage.com
Password: TestPassword123!
Click "Login"
```

### Step 4: Verify It Works
```
✅ Should redirect to student portal
✅ Should see "Logout" button in navigation
✅ Should see your training modules
```

### Step 5: Check Database
```
1. Go to: https://app.supabase.com
2. Click your project
3. Click "Table Editor"
4. Click "students" table
5. You should see your test account!
```

---

## 🎯 What Happens Automatically

### When Student Signs Up:
1. Account created in Supabase Auth
2. Student record created in `students` table
3. Empty profile created in `student_profiles` table
4. Verification email sent (if enabled)

### When Student Logs In:
1. Credentials verified
2. Session token created
3. Last login timestamp updated
4. Progress loaded from database
5. Redirected to portal

### When Student Completes Module:
1. Progress saved to localStorage
2. Progress synced to database
3. `student_module_progress` table updated
4. Activity logged

### When Student Takes Assessment:
1. Results saved to localStorage
2. Results synced to database
3. `assessment_results` table updated
4. Activity logged

---

## 🔑 Important URLs

**Student Login:**
```
http://localhost/student-portal/login.html
```

**Student Portal:**
```
http://localhost/student-portal/index.html
```

**Supabase Dashboard:**
```
https://app.supabase.com
```

---

## 📝 Quick Commands (Browser Console)

### Check if logged in:
```javascript
Auth.isLoggedIn()
```

### Get current user:
```javascript
Auth.getCurrentUser()
```

### Manual logout:
```javascript
Auth.signOut()
```

### View progress:
```javascript
StudentData.getModuleProgress(window.currentUser.id)
```

### View assessment results:
```javascript
StudentData.getAssessmentResults(window.currentUser.id)
```

---

## ✅ Success Indicators

### Login Page Works:
- [ ] Page loads without errors
- [ ] Can switch between Login/Signup tabs
- [ ] Forms submit without errors

### Authentication Works:
- [ ] Can create new account
- [ ] Can login with credentials
- [ ] Redirects to portal after login
- [ ] Can't access portal without login

### Database Works:
- [ ] Student appears in Supabase
- [ ] Progress saves to database
- [ ] Assessment results save
- [ ] Can view data in Supabase dashboard

---

## 🐛 Quick Fixes

### Can't see login page?
```
Check file path: student-portal/login.html
Make sure web server is running
```

### Login doesn't work?
```
Open browser console (F12)
Check for error messages
Verify Supabase credentials in supabase-config.js
```

### Progress not saving?
```
Check browser console for errors
Verify you're logged in
Check Supabase dashboard for data
```

### Redirects to login immediately?
```
This is normal! Portal is protected
You must login first
```

---

## 📞 Need Help?

1. Check browser console (F12) for errors
2. Check Supabase dashboard for data
3. Review SUPABASE_SETUP_GUIDE.md for details
4. Check network tab for failed requests

---

**Ready to go! Start by testing the signup flow. 🎉**
