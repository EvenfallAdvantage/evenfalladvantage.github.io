# Import Existing Slides - Instructions

## Quick Import Method

Since your slides are already in `student-portal/js/slideshow.js`, here's the easiest way to import them:

### Option 1: Copy the Data Directly (Recommended)

1. **Open the browser console** on your admin dashboard (F12)

2. **Load the slideshow data** by running:
```javascript
// Load the slideshow.js file content
const script = document.createElement('script');
script.src = '../student-portal/js/slideshow.js';
document.head.appendChild(script);
```

3. **Wait a moment**, then run the import function:
```javascript
// After slideshow.js loads, run this:
async function importAllSlides() {
    console.log('Starting import of all modules...');
    
    // Get all training modules
    const { data: modules, error: modulesError } = await supabase
        .from('training_modules')
        .select('id, module_code');
    
    if (modulesError) {
        console.error('Error loading modules:', modulesError);
        return;
    }
    
    console.log('Found modules:', modules);
    
    let totalImported = 0;
    
    // Import slides for each module
    for (const module of modules) {
        const slides = moduleSlidesData[module.module_code];
        
        if (!slides) {
            console.log(`❌ No slides found for ${module.module_code}`);
            continue;
        }
        
        console.log(`📝 Importing ${slides.length} slides for ${module.module_code}...`);
        
        // Check if slides already exist
        const { data: existingSlides } = await supabase
            .from('module_slides')
            .select('id')
            .eq('module_id', module.id);
        
        if (existingSlides && existingSlides.length > 0) {
            console.log(`⚠️  Slides already exist for ${module.module_code}, skipping...`);
            continue;
        }
        
        // Prepare slides for insertion
        const slidesToInsert = slides.map((slide, index) => ({
            module_id: module.id,
            slide_number: index + 1,
            slide_type: 'text',
            title: slide.title,
            content: slide.content.trim(),
            notes: 'Imported from student portal'
        }));
        
        // Insert slides
        const { error: insertError } = await supabase
            .from('module_slides')
            .insert(slidesToInsert);
        
        if (insertError) {
            console.error(`❌ Error importing slides for ${module.module_code}:`, insertError);
        } else {
            console.log(`✅ Successfully imported ${slides.length} slides for ${module.module_code}`);
            totalImported += slides.length;
        }
    }
    
    console.log(`\n🎉 Import complete! Total slides imported: ${totalImported}`);
    alert(`Successfully imported ${totalImported} slides across all modules!`);
    
    // Reload courses
    if (typeof loadCourses === 'function') {
        loadCourses();
    }
}

// Run the import
importAllSlides();
```

### Option 2: Use the Import Button (Simpler)

1. **Run `COURSE_MANAGEMENT_SETUP.sql`** in Supabase (if not done already)

2. **Refresh the admin dashboard**

3. **Go to Courses section**

4. **Click "Import Existing Slides"** button
   - Note: The current button only imports one module as an example
   - You'll need to update `admin/js/import-slides.js` with all module data

5. **Edit courses** - slides should now appear!

## Module Codes to Import

The following modules have slides ready to import:

1. `communication-protocols` - Security Radio Communications
2. `stop-the-bleed` - STOP THE BLEED® Emergency Medical Response  
3. `threat-assessment` - Threat Assessment & Situational Awareness
4. `ics-100` - Introduction to ICS-100 (if exists)
5. `diverse-population` - Interacting with Diverse Populations
6. `crowd-management` - Crowd Management & Public Safety
7. `use-of-force` - Legal Aspects & Use of Force
8. `emergency-response` - Emergency Response (if exists)
9. `access-screening` - Access Control & Screening (if exists)

## Verification

After importing, verify by:

1. Go to Courses section
2. Click "Edit Module" on any course
3. You should see all the slides listed
4. You can now edit text, add images/videos, reorder slides

## Troubleshooting

**"No slides found for module_code"**
- The module_code in your database doesn't match the slideshow.js keys
- Check your training_modules table: `SELECT id, module_code FROM training_modules;`
- Update module codes to match slideshow.js keys

**"Slides already exist"**
- Slides were already imported for that module
- To re-import, delete existing slides first:
  ```sql
  DELETE FROM module_slides WHERE module_id = 'YOUR_MODULE_ID';
  ```

**Permission errors**
- Ensure you're logged in as admin
- Check RLS policies are set up correctly
- Run `COURSE_MANAGEMENT_SETUP.sql` again

## Next Steps

After importing:
1. Edit each course to add images/videos to slides
2. Reorder slides if needed
3. Add instructor notes
4. Test courses in student portal
5. Update content as needed

The slides are now in the database and fully editable through the admin dashboard! 🎉
