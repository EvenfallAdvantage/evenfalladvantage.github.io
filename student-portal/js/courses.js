// Course Catalog JavaScript

let currentUser = null;
let allCourses = [];
let myEnrollments = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    currentUser = await Auth.getCurrentUser();
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // Set up logout
    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        await Auth.signOut();
        window.location.href = 'login.html';
    });

    // Check for success/cancel messages
    checkUrlParams();

    // Load courses
    await loadCourses();
});

// Check URL parameters for payment status
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const alertDiv = document.getElementById('alertMessage');

    if (urlParams.get('success') === 'true') {
        const courseId = urlParams.get('course');
        showAlert('Payment successful! You now have access to the course.', 'success');
        // Remove params from URL
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('canceled') === 'true') {
        showAlert('Payment was cancelled. You can try again anytime.', 'info');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Show alert message
function showAlert(message, type = 'info') {
    const alertDiv = document.getElementById('alertMessage');
    alertDiv.textContent = message;
    alertDiv.className = `alert-message ${type}`;
    alertDiv.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
        alertDiv.style.display = 'none';
    }, 5000);
}

// Load all courses and enrollments
async function loadCourses() {
    try {
        // Load student's enrollments
        const { data: enrollments, error: enrollError } = await supabase
            .from('student_course_enrollments')
            .select(`
                *,
                courses (*)
            `)
            .eq('student_id', currentUser.id)
            .in('enrollment_status', ['active', 'completed']);

        if (enrollError) throw enrollError;
        myEnrollments = enrollments || [];

        // Load all active courses
        const { data: courses, error: coursesError } = await supabase
            .from('courses')
            .select('*')
            .eq('is_active', true)
            .order('display_order');

        if (coursesError) throw coursesError;
        allCourses = courses || [];

        // Render courses
        renderMyCourses();
        renderAvailableCourses();
    } catch (error) {
        console.error('Error loading courses:', error);
        showAlert('Error loading courses. Please refresh the page.', 'error');
    }
}

// Render enrolled courses
function renderMyCourses() {
    const container = document.getElementById('myCoursesContainer');

    if (myEnrollments.length === 0) {
        container.innerHTML = `
            <div class="no-courses-message">
                <i class="fas fa-graduation-cap"></i>
                <p>You haven't enrolled in any courses yet.</p>
                <p>Browse available courses below to get started!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = myEnrollments.map(enrollment => {
        const course = enrollment.courses;
        return createCourseCard(course, enrollment);
    }).join('');

    // Add event listeners
    addCourseCardListeners();
}

// Render available courses (not enrolled)
function renderAvailableCourses() {
    const container = document.getElementById('availableCoursesContainer');
    const enrolledCourseIds = myEnrollments.map(e => e.course_id);
    const availableCourses = allCourses.filter(c => !enrolledCourseIds.includes(c.id));

    if (availableCourses.length === 0) {
        container.innerHTML = `
            <div class="no-courses-message">
                <i class="fas fa-check-circle"></i>
                <p>You're enrolled in all available courses!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = availableCourses.map(course => {
        return createCourseCard(course, null);
    }).join('');

    // Add event listeners
    addCourseCardListeners();
}

// Create course card HTML
function createCourseCard(course, enrollment = null) {
    const isEnrolled = enrollment !== null;
    const progress = enrollment ? enrollment.completion_percentage || 0 : 0;
    const isFree = course.price === 0 || course.price === null;

    return `
        <div class="course-card ${isEnrolled ? 'enrolled' : ''}" data-course-id="${course.id}">
            <div class="course-thumbnail">
                ${course.thumbnail_url 
                    ? `<img src="${course.thumbnail_url}" alt="${course.course_name}">`
                    : `<i class="${course.icon || 'fa-graduation-cap'} fas"></i>`
                }
            </div>
            <div class="course-content">
                <div class="course-header">
                    <h3 class="course-title">${course.course_name}</h3>
                    <div class="course-meta">
                        ${course.duration_hours ? `
                            <span class="course-meta-item">
                                <i class="fas fa-clock"></i>
                                ${course.duration_hours} hours
                            </span>
                        ` : ''}
                        ${course.difficulty_level ? `
                            <span class="course-meta-item">
                                <i class="fas fa-signal"></i>
                                ${course.difficulty_level}
                            </span>
                        ` : ''}
                    </div>
                </div>
                <p class="course-description">
                    ${course.short_description || course.description || 'No description available'}
                </p>
                ${isEnrolled ? `
                    <div class="course-progress">
                        <div class="progress-label">
                            <span>Progress</span>
                            <span>${Math.round(progress)}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                    </div>
                ` : ''}
                <div class="course-footer">
                    <div class="course-price ${isFree ? 'free' : ''}">
                        ${isFree ? 'FREE' : `$${course.price.toFixed(2)}`}
                    </div>
                    <div class="course-actions">
                        <button class="btn-course btn-secondary view-details-btn" data-course-id="${course.id}">
                            <i class="fas fa-info-circle"></i> Details
                        </button>
                        ${isEnrolled ? `
                            <a href="learn.html" class="btn-course btn-success">
                                <i class="fas fa-play"></i> Continue
                            </a>
                        ` : `
                            <button class="btn-course btn-primary enroll-btn" data-course-id="${course.id}">
                                <i class="fas fa-shopping-cart"></i> ${isFree ? 'Enroll' : 'Purchase'}
                            </button>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Add event listeners to course cards
function addCourseCardListeners() {
    // View details buttons
    document.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const courseId = e.currentTarget.dataset.courseId;
            showCourseDetails(courseId);
        });
    });

    // Enroll/Purchase buttons
    document.querySelectorAll('.enroll-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const courseId = e.currentTarget.dataset.courseId;
            handleEnrollment(courseId);
        });
    });
}

// Show course details modal
async function showCourseDetails(courseId) {
    const course = allCourses.find(c => c.id === courseId);
    if (!course) return;

    const enrollment = myEnrollments.find(e => e.course_id === courseId);
    const isEnrolled = enrollment !== null;
    const isFree = course.price === 0 || course.price === null;

    // Load course modules
    const { data: courseModules, error } = await supabase
        .from('course_modules')
        .select(`
            *,
            training_modules (
                module_name,
                module_code,
                duration_minutes,
                difficulty_level
            )
        `)
        .eq('course_id', courseId)
        .order('module_order');

    if (error) {
        console.error('Error loading course modules:', error);
    }

    const modules = courseModules || [];

    // Build modal content
    const modalContent = `
        <div class="course-detail-header">
            <span class="close">&times;</span>
            <h2>${course.course_name}</h2>
            <div class="course-meta">
                ${course.duration_hours ? `<span><i class="fas fa-clock"></i> ${course.duration_hours} hours</span>` : ''}
                ${course.difficulty_level ? `<span><i class="fas fa-signal"></i> ${course.difficulty_level}</span>` : ''}
                ${modules.length ? `<span><i class="fas fa-book"></i> ${modules.length} modules</span>` : ''}
            </div>
        </div>
        <div class="course-detail-body">
            <div class="detail-section">
                <h3><i class="fas fa-info-circle"></i> About This Course</h3>
                <p>${course.description || 'No description available'}</p>
            </div>

            ${course.learning_objectives && course.learning_objectives.length > 0 ? `
                <div class="detail-section">
                    <h3><i class="fas fa-bullseye"></i> Learning Objectives</h3>
                    <ul class="objectives-list">
                        ${course.learning_objectives.map(obj => `<li>${obj}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}

            ${course.target_audience ? `
                <div class="detail-section">
                    <h3><i class="fas fa-users"></i> Who This Course Is For</h3>
                    <p>${course.target_audience}</p>
                </div>
            ` : ''}

            ${modules.length > 0 ? `
                <div class="detail-section">
                    <h3><i class="fas fa-list"></i> Course Modules</h3>
                    <div class="modules-list">
                        ${modules.map(cm => `
                            <div class="module-item">
                                <div class="module-info">
                                    <div class="module-name">
                                        Module ${cm.module_order}: ${cm.training_modules.module_name}
                                    </div>
                                    <div class="module-meta">
                                        ${cm.training_modules.duration_minutes ? `${cm.training_modules.duration_minutes} minutes` : ''}
                                        ${cm.training_modules.difficulty_level ? ` • ${cm.training_modules.difficulty_level}` : ''}
                                    </div>
                                </div>
                                <span class="module-status ${cm.is_required ? 'required' : 'optional'}">
                                    ${cm.is_required ? 'Required' : 'Optional'}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
        <div class="course-detail-footer">
            <div class="detail-price ${isFree ? 'free' : ''}">
                ${isFree ? 'FREE' : `$${course.price.toFixed(2)}`}
            </div>
            ${isEnrolled ? `
                <a href="learn.html" class="btn-course btn-success">
                    <i class="fas fa-play"></i> Go to Course
                </a>
            ` : `
                <button class="btn-course btn-primary" onclick="handleEnrollment('${courseId}')">
                    <i class="fas fa-shopping-cart"></i> ${isFree ? 'Enroll Now' : 'Purchase Course'}
                </button>
            `}
        </div>
    `;

    document.getElementById('courseDetailContent').innerHTML = modalContent;
    const modal = document.getElementById('courseModal');
    modal.classList.add('show');

    // Close modal handlers
    const closeBtn = modal.querySelector('.close');
    closeBtn.onclick = () => modal.classList.remove('show');
    window.onclick = (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    };
}

// Handle enrollment/purchase
async function handleEnrollment(courseId) {
    const course = allCourses.find(c => c.id === courseId);
    if (!course) return;

    const isFree = course.price === 0 || course.price === null;

    if (isFree) {
        // Free course - enroll directly
        await enrollInFreeCourse(courseId);
    } else {
        // Paid course - redirect to Stripe Checkout
        await initiateCheckout(courseId);
    }
}

// Enroll in free course
async function enrollInFreeCourse(courseId) {
    try {
        const { data, error } = await supabase
            .from('student_course_enrollments')
            .insert({
                student_id: currentUser.id,
                course_id: courseId,
                enrollment_status: 'active',
                enrollment_type: 'free',
                amount_paid: 0,
                currency: 'USD'
            })
            .select()
            .single();

        if (error) throw error;

        showAlert('Successfully enrolled! Redirecting to course...', 'success');
        setTimeout(() => {
            window.location.href = 'learn.html';
        }, 1500);
    } catch (error) {
        console.error('Error enrolling in course:', error);
        showAlert('Error enrolling in course. Please try again.', 'error');
    }
}

// Initiate Stripe Checkout
async function initiateCheckout(courseId) {
    try {
        // Show loading state
        showAlert('Preparing checkout...', 'info');

        // Call Edge Function to create checkout session
        const { data, error } = await supabase.functions.invoke('create-checkout-session', {
            body: {
                courseId: courseId,
                studentId: currentUser.id,
                successUrl: `${window.location.origin}/student-portal/courses.html?success=true&course=${courseId}`,
                cancelUrl: `${window.location.origin}/student-portal/courses.html?canceled=true`
            }
        });

        if (error) throw error;

        if (data && data.url) {
            // Redirect to Stripe Checkout
            window.location.href = data.url;
        } else {
            throw new Error('No checkout URL returned');
        }
    } catch (error) {
        console.error('Error creating checkout session:', error);
        showAlert('Error starting checkout. Please try again or contact support.', 'error');
    }
}

// Make handleEnrollment globally accessible for modal button
window.handleEnrollment = handleEnrollment;
