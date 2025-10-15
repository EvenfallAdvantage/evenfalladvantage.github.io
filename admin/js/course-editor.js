// Course Editor Functions

// Edit existing course
async function editCourse(id) {
    try {
        // Load module data
        const { data: module, error } = await supabase
            .from('training_modules')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        // Load slides
        const { data: slides, error: slidesError } = await supabase
            .from('module_slides')
            .select('*')
            .eq('module_id', id)
            .order('slide_number');

        if (slidesError) console.error('Error loading slides:', slidesError);

        showCourseEditorModal(module, slides || []);
    } catch (error) {
        console.error('Error loading course:', error);
        showAlert('Error loading course: ' + error.message, 'error');
    }
}

// Show course editor modal
function showCourseEditorModal(module = null, slides = []) {
    const isEdit = module !== null;
    const title = isEdit ? 'Edit Module' : 'Create New Module';
    
    const modalHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-content course-editor-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="close-btn" onclick="closeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="courseEditorForm" onsubmit="${isEdit ? `updateCourse(event, '${module.id}')` : 'createCourse(event)'}">
                        <!-- Module Details -->
                        <div class="course-details-section">
                            <h3>Module Details</h3>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Module Name *</label>
                                    <input type="text" name="module_name" value="${module?.module_name || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label>Module Code *</label>
                                    <input type="text" name="module_code" value="${module?.module_code || ''}" required>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Description</label>
                                <textarea name="description" rows="3">${module?.description || ''}</textarea>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Estimated Time</label>
                                    <input type="text" name="estimated_time" value="${module?.estimated_time || ''}" placeholder="e.g., 90 min">
                                </div>
                                <div class="form-group">
                                    <label>Difficulty Level</label>
                                    <select name="difficulty_level">
                                        <option value="Essential" ${module?.difficulty_level === 'Essential' ? 'selected' : ''}>Essential</option>
                                        <option value="Critical" ${module?.difficulty_level === 'Critical' ? 'selected' : ''}>Critical</option>
                                        <option value="Advanced" ${module?.difficulty_level === 'Advanced' ? 'selected' : ''}>Advanced</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Module Icon</label>
                                    <input type="hidden" name="icon" id="selectedIcon" value="${module?.icon || 'fa-book'}">
                                    <div style="display: flex; gap: 1rem; align-items: center;">
                                        <button type="button" class="btn btn-secondary" onclick="openIconPicker()" style="flex: 1;">
                                            <i class="fas fa-icons"></i> Choose Icon
                                        </button>
                                        <div id="iconPreview" style="width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; background: var(--admin-primary); color: white; border-radius: 0.5rem; font-size: 2rem;">
                                            <i class="fas ${module?.icon || 'fa-book'}"></i>
                                        </div>
                                    </div>
                                    <small style="color: var(--admin-text-secondary); margin-top: 0.5rem; display: block;">
                                        Current: <span id="currentIconName">${module?.icon || 'fa-book'}</span>
                                    </small>
                                </div>
                            </div>
                        </div>

                        <!-- Slides Section -->
                        <div class="slides-section">
                            <div class="slides-header">
                                <h3>Course Slides</h3>
                                <button type="button" class="btn btn-secondary btn-small" onclick="addSlide()">
                                    <i class="fas fa-plus"></i> Add Slide
                                </button>
                            </div>
                            <div id="slidesContainer" class="slides-container">
                                ${slides.length > 0 ? slides.map((slide, index) => createSlideHTML(slide, index)).join('') : '<p class="no-slides">No slides yet. Click "Add Slide" to get started.</p>'}
                            </div>
                        </div>

                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save"></i> ${isEdit ? 'Update Module' : 'Create Module'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Initialize Quill editors for existing slides
    setTimeout(() => {
        slides.forEach((slide, index) => {
            initializeQuillEditor(index);
        });
    }, 100);
}

// Create HTML for a slide
function createSlideHTML(slide = null, index = 0) {
    const slideNum = slide?.slide_number || index + 1;
    const slideType = slide?.slide_type || 'text';
    
    return `
        <div class="slide-editor" data-slide-index="${index}">
            <div class="slide-editor-header">
                <span class="slide-number">Slide ${slideNum}</span>
                <div class="slide-actions">
                    <button type="button" class="btn-icon" onclick="moveSlideUp(${index})" title="Move Up">
                        <i class="fas fa-arrow-up"></i>
                    </button>
                    <button type="button" class="btn-icon" onclick="moveSlideDown(${index})" title="Move Down">
                        <i class="fas fa-arrow-down"></i>
                    </button>
                    <button type="button" class="btn-icon btn-danger" onclick="removeSlide(${index})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="slide-editor-body">
                <input type="hidden" name="slides[${index}][slide_number]" value="${slideNum}">
                <input type="hidden" name="slides[${index}][id]" value="${slide?.id || ''}">
                
                <div class="form-group">
                    <label>Slide Type</label>
                    <select name="slides[${index}][slide_type]" onchange="updateSlideType(${index}, this.value)">
                        <option value="text" ${slideType === 'text' ? 'selected' : ''}>Text Only</option>
                        <option value="image" ${slideType === 'image' ? 'selected' : ''}>Image</option>
                        <option value="video" ${slideType === 'video' ? 'selected' : ''}>Video</option>
                        <option value="mixed" ${slideType === 'mixed' ? 'selected' : ''}>Mixed (Text + Media)</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Slide Title</label>
                    <input type="text" name="slides[${index}][title]" value="${slide?.title || ''}" placeholder="Slide title">
                </div>
                
                <div class="form-group slide-content-group">
                    <label>Content <span class="help-text">(Use the toolbar to format text - no HTML knowledge needed!)</span></label>
                    <div id="editor-${index}" class="quill-editor">${slide?.content || ''}</div>
                    <input type="hidden" name="slides[${index}][content]" id="content-${index}">
                </div>
                
                <div class="media-upload-section" style="display: ${['image', 'video', 'mixed'].includes(slideType) ? 'block' : 'none'}">
                    ${slideType === 'image' || slideType === 'mixed' ? `
                        <div class="form-group">
                            <label>Image</label>
                            <input type="file" name="slides[${index}][image_file]" accept="image/*" onchange="previewImage(${index}, this)">
                            ${slide?.image_url ? `
                                <div class="current-media" id="currentImage${index}">
                                    <img src="${slide.image_url}" alt="Current image">
                                    <button type="button" class="btn btn-danger btn-small" onclick="removeMedia(${index}, 'image')">
                                        <i class="fas fa-trash"></i> Remove Image
                                    </button>
                                    <input type="hidden" name="slides[${index}][image_url]" value="${slide.image_url}">
                                </div>
                            ` : ''}
                            <div id="imagePreview${index}" class="media-preview"></div>
                        </div>
                    ` : ''}
                    
                    ${slideType === 'video' || slideType === 'mixed' ? `
                        <div class="form-group">
                            <label>Video URL or Upload</label>
                            <input type="text" name="slides[${index}][video_url]" value="${slide?.video_url || ''}" placeholder="YouTube/Vimeo URL or upload file">
                            <input type="file" name="slides[${index}][video_file]" accept="video/*" onchange="previewVideo(${index}, this)">
                            ${slide?.video_url ? `
                                <div class="current-media" id="currentVideo${index}">
                                    <video controls src="${slide.video_url}"></video>
                                    <button type="button" class="btn btn-danger btn-small" onclick="removeMedia(${index}, 'video')">
                                        <i class="fas fa-trash"></i> Remove Video
                                    </button>
                                </div>
                            ` : ''}
                            <div id="videoPreview${index}" class="media-preview"></div>
                        </div>
                    ` : ''}
                </div>
                
                <div class="form-group">
                    <label>Notes (for instructors)</label>
                    <textarea name="slides[${index}][notes]" rows="2" placeholder="Internal notes">${slide?.notes || ''}</textarea>
                </div>
            </div>
        </div>
    `;
}

// Store Quill editor instances
const quillEditors = {};

// Add new slide
function addSlide() {
    const container = document.getElementById('slidesContainer');
    const noSlides = container.querySelector('.no-slides');
    if (noSlides) noSlides.remove();
    
    const currentSlides = container.querySelectorAll('.slide-editor').length;
    const slideHTML = createSlideHTML(null, currentSlides);
    container.insertAdjacentHTML('beforeend', slideHTML);
    
    // Initialize Quill editor for the new slide
    initializeQuillEditor(currentSlides);
}

// Initialize Quill rich text editor for a slide
function initializeQuillEditor(index) {
    const editorElement = document.getElementById(`editor-${index}`);
    if (!editorElement) return;
    
    // Destroy existing editor if it exists
    if (quillEditors[index]) {
        delete quillEditors[index];
    }
    
    // Create new Quill editor
    const quill = new Quill(`#editor-${index}`, {
        theme: 'snow',
        placeholder: 'Enter slide content here...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link'],
                ['clean']
            ]
        }
    });
    
    // Store editor instance
    quillEditors[index] = quill;
    
    // Update hidden input when content changes
    quill.on('text-change', () => {
        const contentInput = document.getElementById(`content-${index}`);
        if (contentInput) {
            contentInput.value = quill.root.innerHTML;
        }
    });
    
    // Set initial content
    const contentInput = document.getElementById(`content-${index}`);
    if (contentInput) {
        contentInput.value = quill.root.innerHTML;
    }
}

// Remove slide
function removeSlide(index) {
    if (!confirm('Are you sure you want to delete this slide?')) return;
    
    const container = document.getElementById('slidesContainer');
    const slides = container.querySelectorAll('.slide-editor');
    slides[index].remove();
    
    // Reindex remaining slides
    reindexSlides();
    
    if (container.querySelectorAll('.slide-editor').length === 0) {
        container.innerHTML = '<p class="no-slides">No slides yet. Click "Add Slide" to get started.</p>';
    }
}

// Move slide up
function moveSlideUp(index) {
    if (index === 0) return;
    
    const container = document.getElementById('slidesContainer');
    const slides = container.querySelectorAll('.slide-editor');
    const slide = slides[index];
    const previousSlide = slides[index - 1];
    
    container.insertBefore(slide, previousSlide);
    reindexSlides();
}

// Move slide down
function moveSlideDown(index) {
    const container = document.getElementById('slidesContainer');
    const slides = container.querySelectorAll('.slide-editor');
    
    if (index >= slides.length - 1) return;
    
    const slide = slides[index];
    const nextSlide = slides[index + 1];
    
    container.insertBefore(nextSlide, slide);
    reindexSlides();
}

// Reindex slides after reordering
function reindexSlides() {
    const container = document.getElementById('slidesContainer');
    const slides = container.querySelectorAll('.slide-editor');
    
    slides.forEach((slide, newIndex) => {
        slide.dataset.slideIndex = newIndex;
        slide.querySelector('.slide-number').textContent = `Slide ${newIndex + 1}`;
        
        // Update all input names
        slide.querySelectorAll('[name^="slides["]').forEach(input => {
            const oldName = input.name;
            const fieldName = oldName.match(/\]\[(.+)\]$/)[1];
            input.name = `slides[${newIndex}][${fieldName}]`;
        });
        
        // Update slide_number hidden input
        const slideNumberInput = slide.querySelector('[name$="[slide_number]"]');
        if (slideNumberInput) slideNumberInput.value = newIndex + 1;
    });
}

// Update slide type
function updateSlideType(index, type) {
    const slide = document.querySelector(`[data-slide-index="${index}"]`);
    const mediaSection = slide.querySelector('.media-upload-section');
    
    if (['image', 'video', 'mixed'].includes(type)) {
        mediaSection.style.display = 'block';
        
        // Update media section content based on type
        let mediaHTML = '';
        
        if (type === 'image' || type === 'mixed') {
            mediaHTML += `
                <div class="form-group">
                    <label>Image</label>
                    <input type="file" name="slides[${index}][image_file]" accept="image/*" onchange="previewImage(${index}, this)">
                    <div id="currentImage${index}" class="current-media"></div>
                    <div id="imagePreview${index}" class="media-preview"></div>
                </div>
            `;
        }
        
        if (type === 'video' || type === 'mixed') {
            mediaHTML += `
                <div class="form-group">
                    <label>Video URL or Upload</label>
                    <input type="text" name="slides[${index}][video_url]" placeholder="YouTube/Vimeo URL or upload file">
                    <input type="file" name="slides[${index}][video_file]" accept="video/*" onchange="previewVideo(${index}, this)">
                    <div id="currentVideo${index}" class="current-media"></div>
                    <div id="videoPreview${index}" class="media-preview"></div>
                </div>
            `;
        }
        
        mediaSection.innerHTML = mediaHTML;
    } else {
        mediaSection.style.display = 'none';
    }
}

// Preview image
function previewImage(index, input) {
    const preview = document.getElementById(`imagePreview${index}`);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Preview video
function previewVideo(index, input) {
    const preview = document.getElementById(`videoPreview${index}`);
    if (input.files && input.files[0]) {
        const url = URL.createObjectURL(input.files[0]);
        preview.innerHTML = `<video controls src="${url}"></video>`;
    }
}

// Remove media (image or video)
function removeMedia(index, type) {
    const confirmed = confirm(`Are you sure you want to remove this ${type}?`);
    if (!confirmed) return;
    
    if (type === 'image') {
        const currentImage = document.getElementById(`currentImage${index}`);
        if (currentImage) {
            currentImage.remove();
        }
        // Clear the file input
        const fileInput = document.querySelector(`input[name="slides[${index}][image_file]"]`);
        if (fileInput) fileInput.value = '';
    } else if (type === 'video') {
        const currentVideo = document.getElementById(`currentVideo${index}`);
        if (currentVideo) {
            currentVideo.remove();
        }
        // Clear the video URL and file input
        const urlInput = document.querySelector(`input[name="slides[${index}][video_url]"]`);
        if (urlInput) urlInput.value = '';
        const fileInput = document.querySelector(`input[name="slides[${index}][video_file]"]`);
        if (fileInput) fileInput.value = '';
    }
}

// Create new course
async function createCourse(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Creating...';
    
    try {
        // Get the highest display_order to add new module at the end
        const { data: maxOrderModule } = await supabase
            .from('training_modules')
            .select('display_order')
            .order('display_order', { ascending: false })
            .limit(1)
            .single();
        
        const nextOrder = (maxOrderModule?.display_order || 7) + 1;
        
        // Create module
        const moduleData = {
            module_name: formData.get('module_name'),
            module_code: formData.get('module_code'),
            description: formData.get('description'),
            estimated_time: formData.get('estimated_time'),
            difficulty_level: formData.get('difficulty_level'),
            icon: formData.get('icon'),
            is_active: true,
            display_order: nextOrder
        };
        
        const { data: module, error: moduleError } = await supabase
            .from('training_modules')
            .insert(moduleData)
            .select()
            .single();
        
        if (moduleError) throw moduleError;
        
        // Process slides
        await processSlides(module.id, formData);
        
        // Create assessment for this module
        await createAssessmentForModule(module);
        
        showAlert('Course created successfully!', 'success');
        closeModal();
        loadCourses();
    } catch (error) {
        console.error('Error creating course:', error);
        showAlert('Error creating course: ' + error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Create Course';
    }
}

// Update existing course
async function updateCourse(event, moduleId) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Updating...';
    
    try {
        // Update module
        const moduleData = {
            module_name: formData.get('module_name'),
            module_code: formData.get('module_code'),
            description: formData.get('description'),
            estimated_time: formData.get('estimated_time'),
            difficulty_level: formData.get('difficulty_level'),
            icon: formData.get('icon')
        };
        
        const { error: moduleError } = await supabase
            .from('training_modules')
            .update(moduleData)
            .eq('id', moduleId);
        
        if (moduleError) throw moduleError;
        
        // Delete existing slides and recreate
        await supabase
            .from('module_slides')
            .delete()
            .eq('module_id', moduleId);
        
        // Process slides
        await processSlides(moduleId, formData);
        
        // Update or create assessment for this module
        const { data: updatedModule } = await supabase
            .from('training_modules')
            .select('*')
            .eq('id', moduleId)
            .single();
        
        if (updatedModule) {
            await updateOrCreateAssessment(updatedModule);
        }
        
        showAlert('Course updated successfully!', 'success');
        closeModal();
        loadCourses();
    } catch (error) {
        console.error('Error updating course:', error);
        showAlert('Error updating course: ' + error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Course';
    }
}

// Process slides (upload media and save to database)
async function processSlides(moduleId, formData) {
    const slides = [];
    let slideIndex = 0;
    
    // Collect all slides
    while (formData.has(`slides[${slideIndex}][slide_number]`)) {
        const slide = {
            module_id: moduleId,
            slide_number: parseInt(formData.get(`slides[${slideIndex}][slide_number]`)),
            slide_type: formData.get(`slides[${slideIndex}][slide_type]`),
            title: formData.get(`slides[${slideIndex}][title]`),
            content: formData.get(`slides[${slideIndex}][content]`),
            notes: formData.get(`slides[${slideIndex}][notes]`),
            image_url: formData.get(`slides[${slideIndex}][image_url]`) || null,
            video_url: formData.get(`slides[${slideIndex}][video_url]`) || null
        };
        
        // Upload image if provided
        const imageFile = formData.get(`slides[${slideIndex}][image_file]`);
        if (imageFile && imageFile.size > 0) {
            const imagePath = await uploadMedia(imageFile, moduleId, slideIndex, 'image');
            slide.image_url = imagePath;
        }
        
        // Upload video if provided
        const videoFile = formData.get(`slides[${slideIndex}][video_file]`);
        if (videoFile && videoFile.size > 0) {
            const videoPath = await uploadMedia(videoFile, moduleId, slideIndex, 'video');
            slide.video_url = videoPath;
        }
        
        slides.push(slide);
        slideIndex++;
    }
    
    // Insert all slides
    if (slides.length > 0) {
        const { error } = await supabase
            .from('module_slides')
            .insert(slides);
        
        if (error) throw error;
    }
}

// Upload media to Supabase Storage
async function uploadMedia(file, moduleId, slideIndex, type) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${moduleId}/slide-${slideIndex}-${type}-${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
        .from('course-media')
        .upload(fileName, file);
    
    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from('course-media')
        .getPublicUrl(fileName);
    
    return publicUrl;
}

// Create assessment for a module
async function createAssessmentForModule(module) {
    try {
        // Determine category based on module order
        // First 7 modules are "Event Security Core", rest are "Miscellaneous"
        const coreModuleCodes = [
            'communication-protocols',
            'stop-the-bleed', 
            'threat-assessment',
            'ics-100',
            'diverse-population',
            'crowd-management',
            'use-of-force'
        ];
        
        const category = coreModuleCodes.includes(module.module_code) 
            ? 'Event Security Core' 
            : 'Miscellaneous';
        
        // Create assessment
        const assessmentData = {
            module_id: module.id,
            assessment_name: `${module.module_name} Assessment`,
            category: category,
            icon: module.icon || 'fa-clipboard-check',
            total_questions: 10, // Default, can be updated later
            passing_score: 80,
            time_limit_minutes: 20
        };
        
        const { error } = await supabase
            .from('assessments')
            .insert(assessmentData);
        
        if (error) {
            console.error('Error creating assessment:', error);
            // Don't throw error - assessment creation is optional
        } else {
            console.log('Assessment created successfully for module:', module.module_name);
        }
    } catch (error) {
        console.error('Error in createAssessmentForModule:', error);
        // Don't throw - we don't want to fail module creation if assessment fails
    }
}

// Update or create assessment for a module
async function updateOrCreateAssessment(module) {
    try {
        // Check if assessment already exists for this module
        const { data: existingAssessment } = await supabase
            .from('assessments')
            .select('*')
            .eq('module_id', module.id)
            .single();
        
        // Determine category
        const coreModuleCodes = [
            'communication-protocols',
            'stop-the-bleed', 
            'threat-assessment',
            'ics-100',
            'diverse-population',
            'crowd-management',
            'use-of-force'
        ];
        
        const category = coreModuleCodes.includes(module.module_code) 
            ? 'Event Security Core' 
            : 'Miscellaneous';
        
        const assessmentData = {
            assessment_name: `${module.module_name} Assessment`,
            category: category,
            icon: module.icon || 'fa-clipboard-check'
        };
        
        if (existingAssessment) {
            // Update existing assessment
            const { error } = await supabase
                .from('assessments')
                .update(assessmentData)
                .eq('id', existingAssessment.id);
            
            if (error) {
                console.error('Error updating assessment:', error);
            } else {
                console.log('Assessment updated successfully for module:', module.module_name);
            }
        } else {
            // Create new assessment
            await createAssessmentForModule(module);
        }
    } catch (error) {
        console.error('Error in updateOrCreateAssessment:', error);
        // Don't throw - we don't want to fail module update if assessment fails
    }
}

// Open icon picker modal
function openIconPicker() {
    const currentIcon = document.getElementById('selectedIcon').value;
    
    const modalHTML = `
        <div class="modal-overlay icon-picker-overlay" onclick="closeIconPicker(event)" style="z-index: 10000;">
            <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 900px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <h2><i class="fas fa-icons"></i> Choose Module Icon</h2>
                    <button class="close-btn" onclick="closeIconPicker()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="flex: 1; overflow: hidden; display: flex; flex-direction: column;">
                    <div style="margin-bottom: 1.5rem;">
                        <input 
                            type="text" 
                            id="iconSearchInput" 
                            placeholder="Search icons... (e.g., fire, shield, user, book)" 
                            style="width: 100%; padding: 0.75rem; border: 2px solid var(--admin-border); border-radius: 0.5rem; font-size: 1rem;"
                            oninput="filterIcons()"
                        >
                        <small style="color: var(--admin-text-secondary); margin-top: 0.5rem; display: block;">
                            Showing <span id="iconCount">0</span> icons
                        </small>
                    </div>
                    <div id="iconGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 0.75rem; overflow-y: auto; padding: 1rem; background: #f8f9fa; border-radius: 0.5rem; flex: 1;">
                        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--admin-text-secondary);">
                            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                            <p>Loading icons...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Load icons dynamically
    setTimeout(() => loadFontAwesomeIcons(currentIcon), 100);
}

// Load Font Awesome icons dynamically
function loadFontAwesomeIcons(currentIcon) {
    // Comprehensive list of Font Awesome 5 Free icons
    const icons = ['ad','address-book','address-card','adjust','air-freshener','align-center','align-justify','align-left','align-right','allergies','ambulance','anchor','angle-double-down','angle-double-left','angle-double-right','angle-double-up','angle-down','angle-left','angle-right','angle-up','angry','archive','arrow-alt-circle-down','arrow-alt-circle-left','arrow-alt-circle-right','arrow-alt-circle-up','arrow-circle-down','arrow-circle-left','arrow-circle-right','arrow-circle-up','arrow-down','arrow-left','arrow-right','arrow-up','arrows-alt','arrows-alt-h','arrows-alt-v','assistive-listening-systems','asterisk','at','atlas','atom','audio-description','award','baby','baby-carriage','backspace','backward','bacon','balance-scale','ban','band-aid','barcode','bars','baseball-ball','basketball-ball','bath','battery-empty','battery-full','battery-half','bed','beer','bell','bell-slash','bicycle','binoculars','biohazard','birthday-cake','blender','blind','bold','bolt','bomb','bone','bong','book','book-dead','book-medical','book-open','book-reader','bookmark','bowling-ball','box','box-open','boxes','braille','brain','bread-slice','briefcase','briefcase-medical','broadcast-tower','broom','brush','bug','building','bullhorn','bullseye','burn','bus','bus-alt','business-time','calculator','calendar','calendar-alt','calendar-check','calendar-day','calendar-minus','calendar-plus','calendar-times','calendar-week','camera','camera-retro','campground','candy-cane','cannabis','capsules','car','car-alt','car-battery','car-crash','car-side','caret-down','caret-left','caret-right','caret-square-down','caret-square-left','caret-square-right','caret-square-up','caret-up','carrot','cart-arrow-down','cart-plus','cash-register','cat','certificate','chair','chalkboard','chalkboard-teacher','charging-station','chart-area','chart-bar','chart-line','chart-pie','check','check-circle','check-double','check-square','cheese','chess','chess-bishop','chess-board','chess-king','chess-knight','chess-pawn','chess-queen','chess-rook','chevron-circle-down','chevron-circle-left','chevron-circle-right','chevron-circle-up','chevron-down','chevron-left','chevron-right','chevron-up','child','church','circle','circle-notch','city','clinic-medical','clipboard','clipboard-check','clipboard-list','clock','clone','closed-captioning','cloud','cloud-download-alt','cloud-meatball','cloud-moon','cloud-moon-rain','cloud-rain','cloud-showers-heavy','cloud-sun','cloud-sun-rain','cloud-upload-alt','cocktail','code','code-branch','coffee','cog','cogs','coins','columns','comment','comment-alt','comment-dollar','comment-dots','comment-medical','comment-slash','comments','comments-dollar','compact-disc','compass','compress','compress-arrows-alt','concierge-bell','cookie','cookie-bite','copy','copyright','couch','credit-card','crop','crop-alt','cross','crosshairs','crow','crown','crutch','cube','cubes','cut','database','deaf','democrat','desktop','dharmachakra','diagnoses','dice','dice-d20','dice-d6','dice-five','dice-four','dice-one','dice-six','dice-three','dice-two','digital-tachograph','directions','divide','dizzy','dna','dog','dollar-sign','dolly','dolly-flatbed','donate','door-closed','door-open','dot-circle','dove','download','drafting-compass','dragon','draw-polygon','drum','drum-steelpan','drumstick-bite','dumbbell','dumpster','dumpster-fire','dungeon','edit','egg','eject','ellipsis-h','ellipsis-v','envelope','envelope-open','envelope-open-text','envelope-square','equals','eraser','ethernet','euro-sign','exchange-alt','exclamation','exclamation-circle','exclamation-triangle','expand','expand-arrows-alt','external-link-alt','external-link-square-alt','eye','eye-dropper','eye-slash','fan','fast-backward','fast-forward','fax','feather','feather-alt','female','fighter-jet','file','file-alt','file-archive','file-audio','file-code','file-contract','file-csv','file-download','file-excel','file-export','file-image','file-import','file-invoice','file-invoice-dollar','file-medical','file-medical-alt','file-pdf','file-powerpoint','file-prescription','file-signature','file-upload','file-video','file-word','fill','fill-drip','film','filter','fingerprint','fire','fire-alt','fire-extinguisher','first-aid','fish','fist-raised','flag','flag-checkered','flag-usa','flask','flushed','folder','folder-minus','folder-open','folder-plus','font','football-ball','forward','frog','frown','frown-open','funnel-dollar','futbol','gamepad','gas-pump','gavel','gem','genderless','ghost','gift','gifts','glass-cheers','glass-martini','glass-martini-alt','glass-whiskey','glasses','globe','globe-africa','globe-americas','globe-asia','globe-europe','golf-ball','gopuram','graduation-cap','greater-than','greater-than-equal','grimace','grin','grin-alt','grin-beam','grin-beam-sweat','grin-hearts','grin-squint','grin-squint-tears','grin-stars','grin-tears','grin-tongue','grin-tongue-squint','grin-tongue-wink','grin-wink','grip-horizontal','grip-lines','grip-lines-vertical','grip-vertical','guitar','h-square','hamburger','hammer','hamsa','hand-holding','hand-holding-heart','hand-holding-usd','hand-lizard','hand-middle-finger','hand-paper','hand-peace','hand-point-down','hand-point-left','hand-point-right','hand-point-up','hand-pointer','hand-rock','hand-scissors','hand-spock','hands','hands-helping','handshake','hanukiah','hard-hat','hashtag','hat-wizard','haykal','hdd','heading','headphones','headphones-alt','headset','heart','heart-broken','heartbeat','helicopter','highlighter','hiking','hippo','history','hockey-puck','holly-berry','home','horse','horse-head','hospital','hospital-alt','hospital-symbol','hot-tub','hotdog','hotel','hourglass','hourglass-end','hourglass-half','hourglass-start','house-damage','hryvnia','i-cursor','ice-cream','icicles','icons','id-badge','id-card','id-card-alt','igloo','image','images','inbox','indent','industry','infinity','info','info-circle','italic','jedi','joint','journal-whills','kaaba','key','keyboard','khanda','kiss','kiss-beam','kiss-wink-heart','kiwi-bird','landmark','language','laptop','laptop-code','laptop-medical','laugh','laugh-beam','laugh-squint','laugh-wink','layer-group','leaf','lemon','less-than','less-than-equal','level-down-alt','level-up-alt','life-ring','lightbulb','link','lira-sign','list','list-alt','list-ol','list-ul','location-arrow','lock','lock-open','long-arrow-alt-down','long-arrow-alt-left','long-arrow-alt-right','long-arrow-alt-up','low-vision','luggage-cart','magic','magnet','mail-bulk','male','map','map-marked','map-marked-alt','map-marker','map-marker-alt','map-pin','map-signs','marker','mars','mars-double','mars-stroke','mars-stroke-h','mars-stroke-v','mask','medal','medkit','meh','meh-blank','meh-rolling-eyes','memory','menorah','mercury','meteor','microchip','microphone','microphone-alt','microphone-alt-slash','microphone-slash','microscope','minus','minus-circle','minus-square','mitten','mobile','mobile-alt','money-bill','money-bill-alt','money-bill-wave','money-bill-wave-alt','money-check','money-check-alt','monument','moon','mortar-pestle','mosque','motorcycle','mountain','mouse-pointer','mug-hot','music','network-wired','neuter','newspaper','not-equal','notes-medical','object-group','object-ungroup','oil-can','om','otter','outdent','pager','paint-brush','paint-roller','palette','pallet','paper-plane','paperclip','parachute-box','paragraph','parking','passport','pastafarianism','paste','pause','pause-circle','paw','peace','pen','pen-alt','pen-fancy','pen-nib','pen-square','pencil-alt','pencil-ruler','people-carry','pepper-hot','percent','percentage','person-booth','phone','phone-alt','phone-slash','phone-square','phone-square-alt','phone-volume','photo-video','piggy-bank','pills','pizza-slice','place-of-worship','plane','plane-arrival','plane-departure','play','play-circle','plug','plus','plus-circle','plus-square','podcast','poll','poll-h','poo','poo-storm','poop','portrait','pound-sign','power-off','pray','praying-hands','prescription','prescription-bottle','prescription-bottle-alt','print','procedures','project-diagram','puzzle-piece','qrcode','question','question-circle','quidditch','quote-left','quote-right','quran','radiation','radiation-alt','rainbow','random','receipt','recycle','redo','redo-alt','registered','remove-format','reply','reply-all','republican','restroom','retweet','ribbon','ring','road','robot','rocket','route','rss','rss-square','ruble-sign','ruler','ruler-combined','ruler-horizontal','ruler-vertical','running','rupee-sign','sad-cry','sad-tear','satellite','satellite-dish','save','school','screwdriver','scroll','sd-card','search','search-dollar','search-location','search-minus','search-plus','seedling','server','shapes','share','share-alt','share-alt-square','share-square','shekel-sign','shield-alt','ship','shipping-fast','shoe-prints','shopping-bag','shopping-basket','shopping-cart','shower','shuttle-van','sign','sign-in-alt','sign-language','sign-out-alt','signal','signature','sim-card','sitemap','skating','skiing','skiing-nordic','skull','skull-crossbones','slash','sleigh','sliders-h','smile','smile-beam','smile-wink','smog','smoking','smoking-ban','sms','snowboarding','snowflake','snowman','snowplow','socks','solar-panel','sort','sort-alpha-down','sort-alpha-down-alt','sort-alpha-up','sort-alpha-up-alt','sort-amount-down','sort-amount-down-alt','sort-amount-up','sort-amount-up-alt','sort-down','sort-numeric-down','sort-numeric-down-alt','sort-numeric-up','sort-numeric-up-alt','sort-up','spa','space-shuttle','spell-check','spider','spinner','splotch','spray-can','square','square-full','square-root-alt','stamp','star','star-and-crescent','star-half','star-half-alt','star-of-david','star-of-life','step-backward','step-forward','stethoscope','sticky-note','stop','stop-circle','stopwatch','store','store-alt','stream','street-view','strikethrough','stroopwafel','subscript','subway','suitcase','suitcase-rolling','sun','superscript','surprise','swatchbook','swimmer','swimming-pool','synagogue','sync','sync-alt','syringe','table','table-tennis','tablet','tablet-alt','tablets','tachometer-alt','tag','tags','tape','tasks','taxi','teeth','teeth-open','temperature-high','temperature-low','tenge','terminal','text-height','text-width','th','th-large','th-list','theater-masks','thermometer','thermometer-empty','thermometer-full','thermometer-half','thermometer-quarter','thermometer-three-quarters','thumbs-down','thumbs-up','thumbtack','ticket-alt','times','times-circle','tint','tint-slash','tired','toggle-off','toggle-on','toilet','toilet-paper','toolbox','tools','tooth','torah','torii-gate','tractor','trademark','traffic-light','train','tram','transgender','transgender-alt','trash','trash-alt','trash-restore','trash-restore-alt','tree','trophy','truck','truck-loading','truck-monster','truck-moving','truck-pickup','tshirt','tty','tv','umbrella','umbrella-beach','underline','undo','undo-alt','universal-access','university','unlink','unlock','unlock-alt','upload','user','user-alt','user-alt-slash','user-astronaut','user-check','user-circle','user-clock','user-cog','user-edit','user-friends','user-graduate','user-injured','user-lock','user-md','user-minus','user-ninja','user-nurse','user-plus','user-secret','user-shield','user-slash','user-tag','user-tie','user-times','users','users-cog','utensil-spoon','utensils','vector-square','venus','venus-double','venus-mars','vial','vials','video','video-slash','vihara','voicemail','volleyball-ball','volume-down','volume-mute','volume-off','volume-up','vote-yea','vr-cardboard','walking','wallet','warehouse','water','wave-square','weight','weight-hanging','wheelchair','wifi','wind','window-close','window-maximize','window-minimize','window-restore','wine-bottle','wine-glass','wine-glass-alt','won-sign','wrench','x-ray','yen-sign','yin-yang'];
    
    const grid = document.getElementById('iconGrid');
    const iconCount = document.getElementById('iconCount');
    
    const iconButtons = icons.map(icon => {
        const iconClass = `fa-${icon}`;
        const isSelected = iconClass === currentIcon;
        const iconName = icon.replace(/-/g, ' ');
        return `
            <button 
                type="button"
                class="icon-option ${isSelected ? 'selected' : ''}" 
                data-icon="${iconClass}"
                onclick="selectIcon('${iconClass}')"
                title="${iconName}"
                style="padding: 1rem; background: white; border: 2px solid ${isSelected ? 'var(--admin-secondary)' : 'var(--admin-border)'}; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; font-size: 0.75rem; color: var(--admin-text-secondary);"
                onmouseover="this.style.borderColor='var(--admin-secondary)'; this.style.transform='scale(1.05)';"
                onmouseout="this.style.borderColor='${isSelected ? 'var(--admin-secondary)' : 'var(--admin-border)'}'; this.style.transform='scale(1)';"
            >
                <i class="fas ${iconClass}" style="font-size: 2rem; color: var(--admin-primary);"></i>
                <span style="text-align: center; word-break: break-word; font-size: 0.7rem;">${iconName}</span>
            </button>
        `;
    }).join('');
    
    grid.innerHTML = iconButtons;
    iconCount.textContent = icons.length;
}

// Filter icons based on search
function filterIcons() {
    const searchTerm = document.getElementById('iconSearchInput').value.toLowerCase();
    const iconButtons = document.querySelectorAll('.icon-option');
    const iconCount = document.getElementById('iconCount');
    let visibleCount = 0;
    
    iconButtons.forEach(button => {
        const iconName = button.dataset.icon.toLowerCase();
        if (iconName.includes(searchTerm)) {
            button.style.display = 'flex';
            visibleCount++;
        } else {
            button.style.display = 'none';
        }
    });
    
    iconCount.textContent = visibleCount;
}

// Select an icon
function selectIcon(iconClass) {
    // Update hidden input
    document.getElementById('selectedIcon').value = iconClass;
    
    // Update preview
    const preview = document.getElementById('iconPreview');
    if (preview) {
        preview.innerHTML = `<i class="fas ${iconClass}"></i>`;
    }
    
    // Update current icon name
    const currentIconName = document.getElementById('currentIconName');
    if (currentIconName) {
        currentIconName.textContent = iconClass;
    }
    
    // Update selected state in picker
    document.querySelectorAll('.icon-option').forEach(btn => {
        btn.classList.remove('selected');
        btn.style.borderColor = 'var(--admin-border)';
    });
    
    const selectedBtn = document.querySelector(`[data-icon="${iconClass}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('selected');
        selectedBtn.style.borderColor = 'var(--admin-secondary)';
    }
    
    // Close picker
    closeIconPicker();
}

// Close icon picker
function closeIconPicker(event) {
    if (event && event.target.classList.contains('modal-overlay')) {
        document.querySelector('.icon-picker-overlay').remove();
    } else if (!event) {
        document.querySelector('.icon-picker-overlay')?.remove();
    }
}

// Export functions
window.editCourse = editCourse;
window.showCourseEditorModal = showCourseEditorModal;
window.addSlide = addSlide;
window.removeSlide = removeSlide;
window.moveSlideUp = moveSlideUp;
window.moveSlideDown = moveSlideDown;
window.updateSlideType = updateSlideType;
window.previewImage = previewImage;
window.previewVideo = previewVideo;
window.removeMedia = removeMedia;
window.createCourse = createCourse;
window.updateCourse = updateCourse;
window.openIconPicker = openIconPicker;
window.closeIconPicker = closeIconPicker;
window.selectIcon = selectIcon;
window.filterIcons = filterIcons;
window.showCreateCourseModal = () => showCourseEditorModal(null, []);
