// Import existing slides from student portal into database
// Run this once from browser console on admin dashboard

async function importExistingSlidesToDatabase() {
    console.log('Starting slide import...');
    
    // Module slides data from student portal
    const moduleSlidesData = {
        'communication-protocols': [
            {
                title: 'Introduction to Security Radio Communications',
                content: `<h3>Why Radio Communication Matters</h3>
<p>Professional radio communication is the backbone of event security operations. Clear, concise communication can mean the difference between a minor incident and a major emergency.</p>
<ul>
<li>Instant communication across large venues</li>
<li>Coordination between security teams</li>
<li>Professional image and efficiency</li>
</ul>`
            },
            {
                title: 'Radio Basics and Equipment',
                content: `<h3>Understanding Your Radio</h3>
<p>Key components and features:</p>
<ul>
<li><strong>PTT (Push-To-Talk)</strong> - Press to speak, release to listen</li>
<li><strong>Volume Control</strong> - Adjust to hear clearly without disturbing others</li>
<li><strong>Channel Selector</strong> - Switch between different communication channels</li>
<li><strong>Antenna</strong> - Keep vertical for best signal</li>
</ul>`
            },
            {
                title: 'The 10-Code System',
                content: `<h3>Common 10-Codes in Security</h3>
<ul>
<li><strong>10-4</strong> - Acknowledged/Understood</li>
<li><strong>10-20</strong> - Location</li>
<li><strong>10-33</strong> - Emergency traffic</li>
<li><strong>10-97</strong> - Arrived at scene</li>
<li><strong>10-98</strong> - Assignment complete</li>
</ul>
<p><em>Note: Some organizations use plain language instead of codes</em></p>`
            },
            {
                title: 'Radio Etiquette',
                content: `<h3>Professional Communication Standards</h3>
<ol>
<li><strong>Listen before transmitting</strong> - Don't interrupt ongoing communications</li>
<li><strong>Be brief and clear</strong> - Keep messages concise</li>
<li><strong>Use proper identification</strong> - State your call sign/position</li>
<li><strong>Speak clearly</strong> - Enunciate and maintain steady pace</li>
<li><strong>Avoid slang</strong> - Use professional language only</li>
</ol>`
            },
            {
                title: 'Emergency Communications',
                content: `<h3>Priority Traffic Procedures</h3>
<p>When an emergency occurs:</p>
<ol>
<li>Use emergency code (10-33) or say "Emergency Traffic"</li>
<li>All other radio traffic stops immediately</li>
<li>State nature of emergency clearly</li>
<li>Provide exact location</li>
<li>Request specific assistance needed</li>
</ol>
<p><strong>Example:</strong> "10-33, 10-33, medical emergency at Gate 3, need EMS immediately"</p>`
            }
        ]
        // Add other modules here...
    };
    
    try {
        // Get all training modules
        const { data: modules, error: modulesError } = await supabase
            .from('training_modules')
            .select('id, module_code');
        
        if (modulesError) throw modulesError;
        
        console.log('Found modules:', modules);
        
        let totalImported = 0;
        
        // Import slides for each module
        for (const module of modules) {
            const slides = moduleSlidesData[module.module_code];
            
            if (!slides) {
                console.log(`No slides found for ${module.module_code}, skipping...`);
                continue;
            }
            
            console.log(`Importing ${slides.length} slides for ${module.module_code}...`);
            
            // Check if slides already exist
            const { data: existingSlides } = await supabase
                .from('module_slides')
                .select('id')
                .eq('module_id', module.id);
            
            if (existingSlides && existingSlides.length > 0) {
                console.log(`Slides already exist for ${module.module_code}, skipping...`);
                continue;
            }
            
            // Prepare slides for insertion
            const slidesToInsert = slides.map((slide, index) => ({
                module_id: module.id,
                slide_number: index + 1,
                slide_type: 'text',
                title: slide.title,
                content: slide.content,
                notes: 'Imported from student portal'
            }));
            
            // Insert slides
            const { error: insertError } = await supabase
                .from('module_slides')
                .insert(slidesToInsert);
            
            if (insertError) {
                console.error(`Error importing slides for ${module.module_code}:`, insertError);
            } else {
                console.log(`✅ Successfully imported ${slides.length} slides for ${module.module_code}`);
                totalImported += slides.length;
            }
        }
        
        console.log(`\n✅ Import complete! Total slides imported: ${totalImported}`);
        alert(`Successfully imported ${totalImported} slides!`);
        
        // Reload courses to show updated slide counts
        if (typeof loadCourses === 'function') {
            loadCourses();
        }
        
    } catch (error) {
        console.error('Error importing slides:', error);
        alert('Error importing slides: ' + error.message);
    }
}

// Export function
window.importExistingSlidesToDatabase = importExistingSlidesToDatabase;

console.log('Slide importer loaded. Run importExistingSlidesToDatabase() to import slides.');
