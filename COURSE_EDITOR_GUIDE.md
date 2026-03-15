# Course Editor - Complete Guide

## 🎓 Overview
The course editor allows administrators to create and manage training modules with slides, text content, images, and videos.

## 📋 Setup Steps

### 1. Run Database Setup
Execute `COURSE_MANAGEMENT_SETUP.sql` in Supabase SQL Editor. This will:
- ✅ Add fields to `training_modules` table (icon, estimated_time, difficulty_level, etc.)
- ✅ Create `module_slides` table for storing slide content
- ✅ Set up RLS policies for admin access
- ✅ Create storage bucket for course media
- ✅ Add triggers for automatic timestamp updates

### 2. Create Storage Bucket (if not auto-created)
If the storage bucket wasn't created automatically:
1. Go to Supabase Dashboard → Storage
2. Click "New Bucket"
3. Name it `course-media`
4. Make it **public**
5. The policies are already set up by the SQL script

### 3. Files Added
- ✅ `admin/js/course-editor.js` - Course editor functionality
- ✅ `admin/css/course-editor.css` - Course editor styling
- ✅ Both files are already linked in `admin/index.html`

## 🚀 Features

### Create New Course
1. Click **"+ Add Course"** button in Courses section
2. Fill in course details:
   - Module Name (e.g., "Security Radio Communications")
   - Module Code (e.g., "RADIO-COMM-101")
   - Description
   - Estimated Time (e.g., "90 min")
   - Difficulty Level (Essential/Critical/Advanced)
   - Icon (FontAwesome class, e.g., "fa-walkie-talkie")

3. Add slides:
   - Click **"+ Add Slide"**
   - Choose slide type:
     - **Text Only** - Just text content
     - **Image** - Image with optional text
     - **Video** - Video with optional text
     - **Mixed** - Text + Image + Video
   - Enter slide title and content
   - Upload media files (images/videos)
   - Add instructor notes (optional)

4. Reorder slides:
   - Use ↑↓ arrows to move slides up/down
   - Use 🗑️ to delete slides

5. Click **"Create Course"** to save

### Edit Existing Course
1. Click **"Edit Module"** on any course card
2. Modify course details
3. Edit/add/remove/reorder slides
4. Upload new media or keep existing
5. Click **"Update Course"** to save

### Slide Types

#### Text Only
- Title + Content (supports HTML)
- Best for: Definitions, explanations, lists

#### Image
- Upload image file (JPG, PNG, GIF)
- Optional title and caption
- Best for: Diagrams, photos, infographics

#### Video
- Upload video file OR paste YouTube/Vimeo URL
- Optional title and description
- Best for: Demonstrations, tutorials

#### Mixed
- Combination of text, image, and video
- Most flexible option
- Best for: Complex topics requiring multiple media types

## 💾 Media Upload

### Supported Formats
- **Images**: JPG, PNG, GIF, WebP
- **Videos**: MP4, WebM, MOV

### File Size Recommendations
- Images: < 5MB (will be displayed at max 100% width)
- Videos: < 50MB (or use YouTube/Vimeo links for larger videos)

### Storage Location
- All media stored in Supabase Storage bucket: `course-media`
- Organized by module ID: `course-media/{module-id}/slide-{index}-{type}-{timestamp}.ext`

## 🎨 Content Formatting

### HTML Support
Slide content supports HTML for rich formatting:

```html
<h3>Heading</h3>
<p>Paragraph text</p>
<ul>
  <li>Bullet point 1</li>
  <li>Bullet point 2</li>
</ul>
<strong>Bold text</strong>
<em>Italic text</em>
```

### Best Practices
- Keep slides concise (3-5 key points per slide)
- Use high-quality images (min 1200px width)
- Test videos before uploading
- Add instructor notes for teaching guidance
- Use consistent formatting across slides

## 🔧 Technical Details

### Database Structure

**training_modules table:**
- `id` - UUID primary key
- `module_name` - Course title
- `module_code` - Unique identifier
- `description` - Course description
- `icon` - FontAwesome icon class
- `estimated_time` - Duration estimate
- `difficulty_level` - Essential/Critical/Advanced
- `is_active` - Published status
- `display_order` - Sort order

**module_slides table:**
- `id` - UUID primary key
- `module_id` - Links to training_modules
- `slide_number` - Order in sequence
- `slide_type` - text/image/video/mixed
- `title` - Slide title
- `content` - HTML content
- `image_url` - Path to image in storage
- `video_url` - Path to video or external URL
- `notes` - Instructor notes

### API Endpoints Used
- `training_modules` - CRUD operations for courses
- `module_slides` - CRUD operations for slides
- `storage.course-media` - Media file uploads

## 🐛 Troubleshooting

### Course not saving
- Check browser console for errors
- Verify admin permissions in `administrators` table
- Ensure RLS policies are set up correctly

### Media not uploading
- Check file size (< 50MB)
- Verify `course-media` storage bucket exists
- Check storage policies are set up
- Ensure bucket is public

### Slides not displaying
- Check `module_slides` table has records
- Verify `module_id` matches `training_modules.id`
- Check `slide_number` sequence is correct

### Permission errors
- Run `COURSE_MANAGEMENT_SETUP.sql` again
- Verify you're logged in as admin
- Check `administrators` table has your user_id

## 📝 Example Course Structure

```
Module: Security Radio Communications
├── Slide 1 (text): Introduction to Radio Protocols
├── Slide 2 (image): Radio Equipment Overview
├── Slide 3 (video): Proper Radio Usage Demo
├── Slide 4 (mixed): Common Radio Codes + Reference Chart
├── Slide 5 (text): Best Practices Summary
└── Slide 6 (text): Quiz/Assessment
```

## 🎯 Next Steps

After creating courses:
1. Test courses in student portal
2. Gather feedback from students
3. Update content based on feedback
4. Add assessments/quizzes (future feature)
5. Track student progress through modules

## 🔐 Security Notes

- Only administrators can create/edit courses
- Students can only view published courses
- Media files are publicly accessible (by design)
- Instructor notes are NOT visible to students
- All changes are logged with timestamps

## 📊 Future Enhancements

Potential features to add:
- [ ] Bulk import from PowerPoint/PDF
- [ ] Slide templates
- [ ] Quiz/assessment builder
- [ ] Video transcripts
- [ ] Slide animations
- [ ] Student annotations
- [ ] Course versioning
- [ ] Analytics dashboard
