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
    const title = isEdit ? 'Edit Course' : 'Create New Course';
    
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
                        <!-- Course Details -->
                        <div class="course-details-section">
                            <h3>Course Details</h3>
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
                                    <label>Icon (FontAwesome class)</label>
                                    <input type="text" name="icon" value="${module?.icon || 'fa-book'}" placeholder="fa-book">
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
                                <i class="fas fa-save"></i> ${isEdit ? 'Update Course' : 'Create Course'}
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
                            ${slide?.image_url ? `<div class="current-media"><img src="${slide.image_url}" alt="Current image"><input type="hidden" name="slides[${index}][image_url]" value="${slide.image_url}"></div>` : ''}
                            <div id="imagePreview${index}" class="media-preview"></div>
                        </div>
                    ` : ''}
                    
                    ${slideType === 'video' || slideType === 'mixed' ? `
                        <div class="form-group">
                            <label>Video URL or Upload</label>
                            <input type="text" name="slides[${index}][video_url]" value="${slide?.video_url || ''}" placeholder="YouTube/Vimeo URL or upload file">
                            <input type="file" name="slides[${index}][video_file]" accept="video/*" onchange="previewVideo(${index}, this)">
                            ${slide?.video_url ? `<div class="current-media"><video controls src="${slide.video_url}"></video></div>` : ''}
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

// Create new course
async function createCourse(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Creating...';
    
    try {
        // Create module
        const moduleData = {
            module_name: formData.get('module_name'),
            module_code: formData.get('module_code'),
            description: formData.get('description'),
            estimated_time: formData.get('estimated_time'),
            difficulty_level: formData.get('difficulty_level'),
            icon: formData.get('icon'),
            is_active: true
        };
        
        const { data: module, error: moduleError } = await supabase
            .from('training_modules')
            .insert(moduleData)
            .select()
            .single();
        
        if (moduleError) throw moduleError;
        
        // Process slides
        await processSlides(module.id, formData);
        
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
window.createCourse = createCourse;
window.updateCourse = updateCourse;
window.showCreateCourseModal = () => showCourseEditorModal(null, []);
