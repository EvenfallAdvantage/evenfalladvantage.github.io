# 🎓 Instructor Portal - Complete Setup Guide

## ✅ What's Been Created

### **Files Created:**
1. **Database Schema**
   - `sql/INSTRUCTOR_PORTAL_SETUP.sql` - Complete database structure

2. **Login Page**
   - `instructor-portal/login.html` - Authentication page with orange theme

3. **Main Portal**
   - `instructor-portal/index.html` - Full dashboard with all features
   - `instructor-portal/css/instructor-portal.css` - Complete styling
   - `instructor-portal/js/instructor-config.js` - Supabase integration
   - `instructor-portal/js/instructor-portal.js` - All portal functionality

4. **Updated Main Login**
   - `login.html` - Now includes Instructor Portal card

---

## 🚀 Setup Steps

### **Step 1: Run Database Schema**

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project: `Evenfall Advantage Student Portal`
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `sql/INSTRUCTOR_PORTAL_SETUP.sql`
6. Paste into the SQL editor
7. Click **Run** or press `Ctrl+Enter`
8. Wait for success message: "Success. No rows returned"

**What This Creates:**
- `instructors` table - Instructor accounts
- `scheduled_classes` table - Class scheduling
- `class_enrollments` table - Student-to-class assignments
- `class_attendance` table - Attendance tracking
- `certificates` table - Certificate issuance
- `instructor_notes` table - Student notes
- `certificate_prerequisites` table - Certification requirements

---

### **Step 2: Create First Instructor Account**

1. In Supabase Dashboard, go to **Authentication** → **Users**
2. Click **Add User**
3. Fill in:
   - **Email:** `instructor@evenfalladvantage.com`
   - **Password:** Choose a secure password
   - **Auto Confirm User:** ✅ Check this box
4. Click **Create User**
5. **Copy the User ID** (UUID) - you'll need this!

6. Go back to **SQL Editor**
7. Run this query (replace `YOUR-USER-ID` with the UUID you copied):

```sql
INSERT INTO instructors (id, email, first_name, last_name, specialization) 
VALUES (
    'YOUR-USER-ID',
    'instructor@evenfalladvantage.com',
    'John',
    'Instructor',
    ARRAY['unarmed_guard', 'ics100']
);
```

8. Click **Run**

---

### **Step 3: Test Login**

1. Open your browser to: `http://localhost:8000/instructor-portal/login.html`
2. Enter credentials:
   - **Email:** `instructor@evenfalladvantage.com`
   - **Password:** (the password you set)
3. Click **Log In**
4. You should be redirected to the instructor dashboard!

---

## 🎯 Features Overview

### **Dashboard**
- View total students, upcoming classes, certificates issued
- Quick view of today's classes
- Upcoming classes list with easy access

### **Student Management**
- View all registered students
- Search students by name or email
- View detailed student profiles including:
  - Module progress
  - Assessment scores
  - Attendance history
  - Issued certificates
- Issue certificates directly from student profile

### **Class Scheduling**
- Schedule new classes with:
  - Class name and type (review, scenario, proctored exam, training)
  - Date and time
  - Duration (default 2 hours, adjustable)
  - Capacity limits
  - Location (physical or virtual)
  - Meeting links for virtual classes
  - Description
- View all classes with filters (scheduled, in progress, completed, cancelled)
- View class details with enrollment lists
- Add/remove students from classes
- Take attendance

### **Certificate Management**
- Check student eligibility for certification
- View prerequisites:
  - Module completion requirements
  - Assessment passing scores
  - Attendance requirements
- Issue Unarmed Guard Certifications
- Auto-generate certificate numbers (format: EA-UG-YYYY-0001)
- Generate verification codes
- Track issued certificates
- View certificate history

---

## 📋 Certificate Prerequisites (Pre-configured)

For **Unarmed Guard Certification**, students must:
1. ✅ Complete Modules 1-7
2. ✅ Pass comprehensive assessment (80%+)
3. ✅ Attend at least 2 proctored classes

These are automatically checked when viewing eligible students.

---

## 🔑 Common Tasks

### **Schedule a Class**
1. Click **Classes** in navigation
2. Click **Schedule New Class** button
3. Fill in class details
4. Click **Save Class**

### **Take Attendance**
1. Go to **Classes** section
2. Click **View Details** on a class
3. Click **Take Attendance** button
4. Mark each student as Present/Absent/Late/Excused

### **Issue a Certificate**
1. Go to **Students** section
2. Click **View** on a student
3. Review their progress and assessments
4. Click **Issue Certificate** button
5. Select certificate type
6. Choose state (if applicable)
7. Click **Issue Certificate**

### **View Student Progress**
1. Go to **Students** section
2. Use search bar to find student
3. Click **View** button
4. Navigate through tabs:
   - Progress (module completion)
   - Assessments (test scores)
   - Attendance (class participation)
   - Certificates (issued certifications)

---

## 🎨 Design Features

### **Color Scheme**
- Primary: Orange (#f39c12)
- Secondary: Dark Orange (#e67e22)
- Distinguished from Student Portal (red) and Client Portal (navy)

### **Responsive Design**
- Works on desktop, tablet, and mobile
- Collapsible navigation
- Mobile-friendly tables and cards

---

## 🔐 Security Features

### **Row Level Security (RLS)**
- Instructors can only view/edit their own classes
- Students can view classes they're enrolled in
- Certificates are accessible by instructors and students
- Instructor notes are private by default

### **Authentication**
- Supabase Auth integration
- Secure session management
- Auto-logout on session expiration

---

## 🛠️ Customization

### **Add More Certificate Types**
Edit `instructor-portal/index.html`, find the certificate type dropdown:
```html
<select id="certificateType">
    <option value="unarmed_guard">Unarmed Guard Certification</option>
    <option value="ics100">ICS-100</option>
    <option value="stop_the_bleed">STOP THE BLEED®</option>
    <!-- Add your custom types here -->
</select>
```

### **Adjust Prerequisites**
Run SQL to add/modify prerequisites:
```sql
INSERT INTO certificate_prerequisites (certificate_type, prerequisite_type, prerequisite_value, description)
VALUES ('your_cert_type', 'module', 'module_id', 'Description');
```

### **Add More Class Types**
Edit class type dropdown in `instructor-portal/index.html`:
```html
<select id="classType">
    <option value="review">Review Session</option>
    <option value="scenario">Scenario Training</option>
    <option value="proctored_exam">Proctored Exam</option>
    <option value="training">General Training</option>
    <!-- Add your custom types -->
</select>
```

---

## 📊 Database Functions Available

### **Certificate Number Generation**
```sql
SELECT generate_certificate_number('unarmed_guard');
-- Returns: EA-UG-2025-0001
```

### **Check All Prerequisites**
Query to see what's required for a certificate:
```sql
SELECT * FROM certificate_prerequisites 
WHERE certificate_type = 'unarmed_guard';
```

---

## 🐛 Troubleshooting

### **Can't Login**
- Verify user exists in Supabase Authentication
- Check that instructor record exists with same UUID
- Confirm `is_active = true` in instructors table
- Check browser console (F12) for errors

### **Students Not Showing**
- Verify students exist in `students` table
- Check RLS policies are enabled
- Confirm Supabase credentials are correct

### **Classes Not Saving**
- Check that instructor_id matches current user
- Verify date/time formats are correct
- Ensure capacity is a positive number

### **Certificates Not Issuing**
- Verify `generate_certificate_number()` function exists
- Check that prerequisites are properly configured
- Confirm student meets all requirements

---

## 📱 Mobile Access

The Instructor Portal is fully responsive:
- **Desktop:** Full dashboard with all features
- **Tablet:** Optimized layout with collapsible sections
- **Mobile:** Touch-friendly interface with simplified navigation

---

## 🔄 Future Enhancements

Consider adding:
- [ ] Email notifications for class schedules
- [ ] PDF certificate generation
- [ ] Bulk enrollment from CSV
- [ ] Student messaging system
- [ ] Calendar integration (Google Calendar, Outlook)
- [ ] Attendance QR codes
- [ ] Video conferencing integration (Daily.co)
- [ ] Grade book functionality
- [ ] Custom certificate templates

---

## 📞 Support

### **Database Issues**
- Supabase Dashboard: https://app.supabase.com
- Check SQL Editor for error messages
- Review RLS policies if access denied

### **Portal Issues**
- Check browser console (F12) for JavaScript errors
- Verify Supabase credentials in `instructor-config.js`
- Clear browser cache and cookies

### **Authentication Issues**
- Confirm user exists in Supabase Auth
- Check that email is verified
- Verify instructor record exists

---

## ✨ Success Checklist

- [x] Database schema created
- [x] Instructor account created
- [x] Can login to instructor portal
- [x] Dashboard loads with statistics
- [x] Can view students list
- [x] Can schedule classes
- [x] Can view student details
- [ ] **Test class scheduling**
- [ ] **Test certificate issuance**
- [ ] **Enroll students in classes**
- [ ] **Take attendance**

---

## 🎉 You're All Set!

Your Instructor Portal is ready to use. Instructors can now:
- Manage students and track their progress
- Schedule and manage classes
- Take attendance
- Issue certificates
- Monitor student eligibility for certifications

**Access the portal at:** `http://localhost:8000/instructor-portal/login.html`

For questions or issues, check the troubleshooting section above or review the database logs in Supabase.
