# Evenfall Advantage - Complete Training Platform

**Last Updated:** November 15, 2025

A comprehensive security guard training and management platform for Evenfall Advantage LLC, a veteran-led security consulting, professional training, and emergency planning firm. The platform includes a public-facing website, student training portal, instructor management portal, client dashboard, and admin panel.

## 🎯 Platform Overview

This is a full-stack web application featuring:
- **Public Website** - Marketing site with case studies and service information
- **Student Portal** - Interactive training modules with AI assistant
- **Instructor Portal** - Class scheduling, student management, and certification
- **Client Portal** - Document management and secure messaging
- **Admin Dashboard** - User management and system administration

## Project Structure

### Public Website
- `index.html` - Main landing page
- `about.html` - About page with company information
- `blog.html` - Case studies overview
- `login.html` - Portal selection page
- `privacy-policy.html` - Privacy policy (CCPA compliant)
- `terms-of-service.html` - Terms of service
- `case-studies/*.html` - Individual case study pages
- `forms/*.html` - Service estimate request forms

### Student Portal (`student-portal/`)
- `login.html` - Student authentication
- `index.html` - Dashboard with module progress
- `training-room.html` - Interactive training with AI assistant
- `instructor-room.html` - Live class interface
- `profile.html` - Student profile and certificates
- `css/` - Student portal styling
- `js/` - Student portal functionality

### Instructor Portal (`instructor-portal/`)
- `login.html` - Instructor authentication
- `index.html` - Dashboard with class management
- `css/instructor-portal.css` - Orange-themed styling
- `js/instructor-config.js` - Supabase configuration
- `js/instructor-portal.js` - Core functionality
- `js/instructor-enrollment.js` - Student enrollment & email notifications

### Client Portal (`client-portal/`)
- `login.html` - Client authentication
- `index.html` - Client dashboard
- `css/` - Client portal styling
- `js/` - Client portal functionality

### Admin Dashboard (`admin/`)
- `login.html` - Admin authentication (secret access via © symbol)
- `index.html` - Admin dashboard
- `css/` - Admin styling
- `js/` - Admin functionality

### Backend (`supabase/`)
- `functions/send-email/` - Email notification Edge Function
- `config.toml` - Supabase function configuration
- `sql/` - Database schema and setup scripts

### Shared Resources
- `includes/` - Reusable components (header, footer)
- `css/` - Global styling
- `js/` - Shared JavaScript utilities
- `images/` - Site imagery

## ✨ Recent Updates (November 2025)

### Instructor Portal Enhancements
- ✅ **Student Enrollment System** - Modal interface for adding students to classes
- ✅ **Email Notifications** - Automatic enrollment emails via Resend API
- ✅ **Supabase Edge Function** - `send-email` function deployed
- ⚠️ **Known Issue:** Email 403 error (needs debugging)

### Legal & Compliance
- ✅ **Privacy Policy** - CCPA-compliant privacy page
- ✅ **Terms of Service** - Comprehensive legal terms
- ✅ Subtle footer placement for legal links

### Design Updates
- ✅ **New Color Scheme** - Updated dark blue from #253646 to #162029
- ✅ **Secret Admin Access** - Copyright symbol trigger on login page
- ✅ Consistent branding across all portals

## 🎯 Core Features

### Public Website
- Modern, responsive design that works across all devices
- Server-Side Includes (SSI) for consistent header and footer
- Interactive case study cards with hover effects
- Comprehensive case studies section with detailed incident analyses
- Service cards with expandable content
- Custom-styled form elements for service estimates

### Student Portal
- Interactive training modules with slide-based content
- AI assistant (Agent Westwood) for real-time help
- Progress tracking and assessment system
- Live instructor room with Daily.co integration
- Profile management with certificate display
- Module completion tracking

### Instructor Portal
- Dashboard with statistics (students, classes, certificates)
- Student management with search and filtering
- Class scheduling and management
- Student enrollment with email notifications
- Certificate issuance and tracking
- Attendance tracking (UI complete, backend pending)
- Orange-themed interface

### Client Portal
- Document management system
- Secure messaging
- Service request tracking
- Navy-themed interface

### Admin Dashboard
- User management (students, instructors, clients)
- System administration
- Database management
- Secret access via copyright symbol

## Technologies Used

- HTML5
- CSS3 (with CSS variables, flexbox, animations)
- Vanilla JavaScript (Fetch API for SSI implementation)
- Font Awesome for icons
- Google Fonts (Montserrat and Raleway)
- Client-side Server-Side Includes implementation

## SSI Implementation

The website uses a client-side implementation of Server-Side Includes to maintain consistent header and footer elements across all pages:

1. Each page includes placeholder divs: `<div id="header-placeholder"></div>` and `<div id="footer-placeholder"></div>`
2. The `include-html.js` script fetches and injects the content from `includes/header.html` and `includes/footer.html`
3. This approach ensures easy maintenance and consistency across the site

## Local Testing

To test the site locally with working SSI functionality:

1. **Using Python**:
   ```
   cd path/to/EvenfallAdvantageWebMobile
   python -m http.server 8000
   ```

2. **Using Node.js**:
   ```
   cd path/to/EvenfallAdvantageWebMobile
   npx http-server
   ```

Then visit `http://localhost:8000` or the indicated port in your browser.

## Deployment

The site can be deployed to any standard web hosting service. For GitHub Pages, simply push the repository and enable GitHub Pages in the repository settings.

## Customization

- Update the email in the CTA section to the correct contact email
- Add social media links in the footer section
- Modify color scheme by changing CSS variables in the `:root` selector in `styles.css`
- Add additional case studies by following the template structure
