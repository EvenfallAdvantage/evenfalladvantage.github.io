# Evenfall Advantage Website

A modern, responsive website for Evenfall Advantage LLC, a veteran-led security consulting, professional training, and emergency planning firm. The site features an enhanced user experience with interactive elements and a comprehensive case studies section.

## Project Structure

- `index.html` - Main landing page
- `about.html` - About page with company information and team structure
- `blog.html` - Case studies overview page with interactive cards
- `case-studies/*.html` - Individual case study pages
- `forms/*.html` - Service estimate request forms
- `includes/` - Server-Side Include components
  - `header.html` - Standardized header with navigation
  - `footer.html` - Standardized footer with CTA section
- `css/` - Styling files
  - `styles.css` - Main styling
  - Additional component-specific CSS files
- `js/` - JavaScript functionality
  - `script.js` - Core interaction scripts
  - `include-html.js` - Server-Side Includes implementation
  - Additional feature-specific JS files
- `images/` - Site imagery and case study photos

## Features

- Modern, responsive design that works across all devices
- Server-Side Includes (SSI) for consistent header and footer across all pages
- Interactive case study cards with hover effects and full-card clickability
- Dynamic color changes on interactive elements for improved user experience
- Comprehensive case studies section with detailed incident analyses
- Service cards with expandable content for detailed information
- Custom-styled form elements for service estimates
- Structured company information with division explanations
- Optimized images for case study presentations

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
