# Portal System Quick Reference Guide

## 🚀 Quick Start

### Access the Portal System
1. Open your browser
2. Navigate to `login.html`
3. Choose your portal:
   - **Student Portal** → Training, Sand Table, Assessments
   - **Client Dashboard** → Business services (requires login)

## 📁 File Structure

```
Main Site
├── login.html                    ← START HERE (Portal Selection)
├── student-portal/
│   ├── index.html               ← Student Portal Home
│   ├── css/student-portal.css   ← Portal Styling
│   └── js/                      ← Portal Scripts
└── client-dashboard/            ← Client Portal (existing)
```

## 🎓 Student Portal Features

### Training Modules
- Security Radio Communications
- STOP THE BLEED® Emergency Response
- Crowd Management
- Emergency Response Protocols
- Access Control & Screening

### Interactive Sand Table
- Drag-and-drop event planning
- Multiple scenarios (concerts, sports events, festivals)
- Real-time validation
- Resource library (guards, barriers, cameras, etc.)

### Assessments
- Timed quizzes
- Instant scoring (70% pass rate)
- Detailed feedback
- Progress tracking

### Progress Dashboard
- Completed modules
- Assessment scores
- Achievements
- Activity history

## 💼 Client Dashboard Features
- Security plans access
- Training materials
- Certification tracking
- Secure messaging
- Service scheduling

## 🎨 Design System

### Colors
- **Primary Blue**: #253646 (Headers, navigation)
- **Orange**: #e74c3c (Buttons, accents)
- **Light Blue**: #3498db (Highlights)
- **Success Green**: #28a745 (Completions)

### Typography
- **Headers**: Montserrat (bold, professional)
- **Body**: Raleway (clean, readable)

## 🔧 Customization

### Update Training Content
**File**: `/student-portal/js/student-portal.js`

```javascript
// Add new module
moduleContent['your-module-id'] = {
    title: 'Your Module Title',
    content: `<h3>Your content here</h3>`
};

// Add assessment questions
assessmentQuestions['your-assessment'] = [
    {
        question: 'Your question?',
        options: ['A', 'B', 'C', 'D'],
        correct: 0
    }
];
```

### Update Styling
**File**: `/student-portal/css/student-portal.css`
- Modify colors, fonts, spacing
- Already uses Evenfall Advantage theme

## 📱 Mobile Support
- Fully responsive design
- Touch-friendly interface
- Optimized for tablets and phones

## 🔐 Security Notes
- Student Portal: Open access (no login required currently)
- Client Dashboard: Requires authentication
- Progress data: Stored in browser localStorage
- No sensitive data transmitted

## 🐛 Troubleshooting

### Portal won't load?
- Check file paths are correct
- Ensure all JS files copied properly
- Clear browser cache

### Progress not saving?
- Enable localStorage in browser
- Not in private/incognito mode
- Check browser compatibility

### Styling looks wrong?
- Verify CSS files linked correctly
- Check for CSS conflicts
- Try different browser

## 📊 Testing URLs

### Local Testing
```
file:///C:/Users/denal/Documents/EvenfallAdvantageWebMobile/login.html
```

### With Local Server (Recommended)
```bash
# Python
cd C:\Users\denal\Documents\EvenfallAdvantageWebMobile
python -m http.server 8000

# Then visit: http://localhost:8000/login.html
```

## ✅ Integration Checklist

- [x] Portal selection page created
- [x] Student Portal integrated
- [x] Client Dashboard connected
- [x] Navigation working
- [x] Styling consistent
- [x] All features functional
- [x] Mobile responsive
- [x] Exit/logout buttons working

## 🎯 Next Steps

1. **Test Everything**: Click through all features
2. **Gather Feedback**: Have users try the portals
3. **Add Authentication**: Implement student login (optional)
4. **Backend Integration**: Replace localStorage with database (future)
5. **Add Content**: Expand training modules as needed

## 📞 Support

For questions or issues:
1. Check `STUDENT_PORTAL_INTEGRATION.md` for detailed docs
2. Review `README.md` in student-portal directory
3. Inspect browser console for errors

---

**Quick Tip**: The Student Portal is ready to use immediately. Just open `login.html` and click "Enter Student Portal"!
