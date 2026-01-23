// =====================================================
// ASSESSMENT COURSE MANAGEMENT
// =====================================================
// This file handles the course-based assessment view
// Similar to the Learn section structure

// Load assessment courses (reuses course data from Learn section)
async function loadAssessmentCourses() {
    const container = document.getElementById('myAssessmentCoursesContainer');
    
    if (!myEnrollments || myEnrollments.length === 0) {
        container.innerHTML = `
            <div class="section-header">
                <h2>My Course Assessments</h2>
                <p>Select a course to view and take its assessments</p>
            </div>
            <p style="text-align: center; padding: 2rem;">No enrolled courses found. Please enroll in a course from the Learn section.</p>
        `;
        return;
    }
    
    const enrolledCourses = myEnrollments.map(e => e.courses);
    
    container.innerHTML = `
        <div class="section-header">
            <h2>My Course Assessments</h2>
            <p>Select a course to view and take its assessments</p>
        </div>
        ${enrolledCourses.map(course => `
            <div class="course-card-inline enrolled" onclick="selectAssessmentCourse('${course.id}')">
                <div class="enrolled-badge">ENROLLED</div>
                <div class="course-thumbnail-inline">
                    <i class="fas ${course.icon || 'fa-trophy'}"></i>
                </div>
                <div class="course-card-content">
                    <h3 class="course-card-title">${course.course_name}</h3>
                    <div class="course-card-meta">
                        ${course.duration_hours ? `<span><i class="fas fa-clock"></i> ${course.duration_hours} hours</span>` : ''}
                        ${course.difficulty_level ? `<span><i class="fas fa-signal"></i> ${course.difficulty_level}</span>` : ''}
                    </div>
                    <p class="course-card-description">${course.short_description || course.description || ''}</p>
                    <div class="course-meta" style="margin-top: 1rem;">
                        <span><i class="fas fa-trophy"></i> Assessments Available</span>
                    </div>
                </div>
            </div>
        `).join('')}
    `;
}

// Select a course to view its assessments
async function selectAssessmentCourse(courseId) {
    const selectedCourse = allCourses.find(c => c.id === courseId);
    if (!selectedCourse) return;

    // Hide courses, show assessments view
    document.getElementById('myAssessmentCoursesContainer').style.display = 'none';
    document.getElementById('courseAssessmentsView').style.display = 'block';

    // Update header
    document.getElementById('selectedAssessmentCourseName').textContent = selectedCourse.course_name;
    document.getElementById('selectedAssessmentCourseDescription').textContent = selectedCourse.description || '';

    // Load assessments for this course
    await loadCourseAssessments(courseId);
}

// Back to assessment courses view
function backToAssessmentCourses() {
    document.getElementById('myAssessmentCoursesContainer').style.display = 'block';
    document.getElementById('courseAssessmentsView').style.display = 'none';
}

// Load assessments for a specific course
async function loadCourseAssessments(courseId) {
    const container = document.getElementById('assessmentListContainer');
    
    try {
        const currentUser = await Auth.getCurrentUser();
        
        // Get course modules
        const { data: courseModules, error: cmError } = await supabase
            .from('course_modules')
            .select('*')
            .eq('course_id', courseId)
            .order('module_order');

        if (cmError) throw cmError;

        if (!courseModules || courseModules.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 2rem;">No assessments available for this course yet.</p>';
            return;
        }

        // Fetch training module details and assessments
        const moduleIds = courseModules.map(cm => cm.module_id);
        const { data: trainingModules, error: tmError } = await supabase
            .from('training_modules')
            .select('*')
            .in('id', moduleIds);

        if (tmError) throw tmError;

        // Fetch assessments for these modules
        const { data: assessments, error: assessError } = await supabase
            .from('assessments')
            .select('*')
            .in('module_id', moduleIds);

        if (assessError) throw assessError;

        // Fetch student progress
        const { data: progressData, error: progressError } = await supabase
            .from('student_module_progress')
            .select('*')
            .eq('student_id', currentUser.id)
            .in('module_id', moduleIds);

        if (progressError) console.error('Error fetching progress:', progressError);

        // Fetch assessment results
        const { data: resultsData, error: resultsError } = await supabase
            .from('assessment_results')
            .select('*')
            .eq('student_id', currentUser.id);

        if (resultsError) console.error('Error fetching results:', resultsError);

        // Create maps
        const moduleMap = {};
        trainingModules.forEach(tm => {
            moduleMap[tm.id] = tm;
        });

        const assessmentMap = {};
        if (assessments) {
            assessments.forEach(a => {
                assessmentMap[a.module_id] = a;
            });
        }

        const progressMap = {};
        if (progressData) {
            progressData.forEach(p => {
                progressMap[p.module_id] = p;
            });
        }

        const resultsMap = {};
        if (resultsData) {
            resultsData.forEach(r => {
                if (!resultsMap[r.assessment_id] || new Date(r.completed_at) > new Date(resultsMap[r.assessment_id].completed_at)) {
                    resultsMap[r.assessment_id] = r;
                }
            });
        }

        // Generate assessment cards
        const assessmentHTML = courseModules.map((cm, index) => {
            const module = moduleMap[cm.module_id];
            const assessment = assessmentMap[cm.module_id];
            const progress = progressMap[cm.module_id];
            
            if (!assessment) return ''; // Skip modules without assessments
            
            const result = resultsMap[assessment.id];
            const isCompleted = progress && progress.completed_at !== null;
            const isPassed = result && result.passed;
            
            let statusBadge = '';
            let buttonText = 'Start Assessment';
            let buttonClass = 'btn-primary';
            let isDisabled = !isCompleted;
            
            if (isPassed) {
                statusBadge = `<div class="completion-badge"><i class="fas fa-check-circle"></i> Passed (${result.score}%)</div>`;
                buttonText = 'Retake Assessment';
                buttonClass = 'btn-secondary';
                isDisabled = false;
            } else if (result) {
                statusBadge = `<div class="completion-badge expired"><i class="fas fa-times-circle"></i> Failed (${result.score}%)</div>`;
                buttonText = 'Retry Assessment';
                buttonClass = 'btn-primary';
                isDisabled = false;
            } else if (!isCompleted) {
                statusBadge = `<div class="completion-badge in-progress"><i class="fas fa-lock"></i> Complete Module First</div>`;
                isDisabled = true;
            }
            
            return `
                <div class="assessment-item ${isPassed ? 'passed' : ''}" data-assessment="${module.module_code}">
                    ${statusBadge}
                    <i class="fas ${module.icon || 'fa-clipboard-check'}"></i>
                    <div>
                        <h4>${assessment.assessment_name}</h4>
                        <p>${assessment.question_count || 20} questions • ${assessment.time_limit || 30} minutes</p>
                        ${assessment.passing_score ? `<p class="text-small">Passing score: ${assessment.passing_score}%</p>` : ''}
                    </div>
                    <button class="btn btn-small ${buttonClass}" 
                            onclick="startAssessment('${module.module_code}')" 
                            ${isDisabled ? 'disabled' : ''}>
                        ${buttonText}
                    </button>
                </div>
            `;
        }).filter(html => html !== '').join('');

        if (assessmentHTML === '') {
            container.innerHTML = '<p style="text-align: center; padding: 2rem;">No assessments available for this course yet.</p>';
        } else {
            container.innerHTML = assessmentHTML;
        }
        
        console.log(`Loaded ${assessments?.length || 0} assessments for course`);
    } catch (error) {
        console.error('Error loading course assessments:', error);
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: red;">Error loading assessments. Please refresh the page.</p>';
    }
}

// Make functions globally accessible
window.loadAssessmentCourses = loadAssessmentCourses;
window.selectAssessmentCourse = selectAssessmentCourse;
window.backToAssessmentCourses = backToAssessmentCourses;
window.loadCourseAssessments = loadCourseAssessments;
