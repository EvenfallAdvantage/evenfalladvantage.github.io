// Assessment Editor Functions

let currentAssessment = null;
let currentQuestions = [];
let selectedStateCode = null; // For Use of Force assessment
let assessmentStateLaws = {}; // Store state laws data

// Load courses for assessment course selection
async function loadAssessments() {
    console.log('loadAssessments() called');
    try {
        // Load all active courses
        const { data: courses, error } = await supabase
            .from('courses')
            .select('*')
            .eq('is_active', true)
            .order('display_order');

        if (error) throw error;

        console.log('Loaded courses for assessments:', courses);
        displayAssessmentCourses(courses || []);
    } catch (error) {
        console.error('Error loading courses:', error);
        document.getElementById('assessmentCoursesGrid').innerHTML = '<p class="error">Error loading courses</p>';
    }
}

// Display courses for assessment selection
function displayAssessmentCourses(courses) {
    const grid = document.getElementById('assessmentCoursesGrid');
    if (!grid) return;

    if (!courses || courses.length === 0) {
        grid.innerHTML = '<p>No courses found</p>';
        return;
    }

    grid.innerHTML = courses.map(course => {
        return `
            <div class="course-card" onclick="selectAssessmentCourse('${course.id}', '${course.course_name}')" style="cursor: pointer;">
                <div class="course-card-header">
                    <h3>${course.course_name}</h3>
                    <span class="badge badge-primary">${course.course_code}</span>
                </div>
                <div class="course-card-body">
                    <p>${course.description || 'No description available'}</p>
                    <div class="course-meta">
                        <span><i class="fas fa-trophy"></i> Assessments</span>
                        <span><i class="fas fa-check-circle"></i> Active</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Select a course to view its assessments
async function selectAssessmentCourse(courseId, courseName) {
    try {
        // Hide course selection, show assessment management
        document.getElementById('assessmentCourseSelectionView').style.display = 'none';
        document.getElementById('assessmentManagementView').style.display = 'block';
        document.getElementById('selectedAssessmentCourseTitle').textContent = courseName;

        // Load modules for this course
        const { data: courseModules, error: cmError } = await supabase
            .from('course_modules')
            .select('module_id')
            .eq('course_id', courseId)
            .order('module_order');

        if (cmError) throw cmError;

        const moduleIds = courseModules.map(cm => cm.module_id);

        // Fetch assessments for these modules
        const { data: assessments, error: assessError } = await supabase
            .from('assessments')
            .select(`
                *,
                training_modules (
                    module_name,
                    module_code,
                    display_order
                )
            `)
            .in('module_id', moduleIds);

        if (assessError) throw assessError;

        displayAssessments(assessments || []);
    } catch (error) {
        console.error('Error loading course assessments:', error);
        document.getElementById('assessmentsList').innerHTML = '<p class="error">Error loading assessments</p>';
    }
}

// Back to course selection
function backToAssessmentCourses() {
    document.getElementById('assessmentCourseSelectionView').style.display = 'block';
    document.getElementById('assessmentManagementView').style.display = 'none';
}

// Make functions globally accessible
window.selectAssessmentCourse = selectAssessmentCourse;
window.backToAssessmentCourses = backToAssessmentCourses;

// Display assessments in table
function displayAssessments(assessments) {
    const container = document.getElementById('assessmentsList');
    
    if (assessments.length === 0) {
        container.innerHTML = '<p>No assessments found</p>';
        return;
    }

    const html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Module</th>
                    <th>Assessment Name</th>
                    <th>Questions</th>
                    <th>Passing Score</th>
                    <th>Time Limit</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${assessments.map(assessment => `
                    <tr>
                        <td>${assessment.training_modules?.module_name || 'N/A'}</td>
                        <td>${assessment.assessment_name}</td>
                        <td>${assessment.total_questions || 0}</td>
                        <td>${assessment.passing_score}%</td>
                        <td>${assessment.time_limit_minutes || 'No limit'} min</td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="editAssessment('${assessment.id}')">
                                <i class="fas fa-edit"></i> Edit Questions
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

// Filter assessments
function filterAssessments() {
    const searchTerm = document.getElementById('searchAssessments').value.toLowerCase();
    const rows = document.querySelectorAll('.data-table tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Load state laws from database
async function loadStateLaws() {
    try {
        const { data: states, error } = await supabase
            .from('state_laws')
            .select('*')
            .order('state_name');
        
        if (error) throw error;
        
        // Convert to object keyed by state_code
        assessmentStateLaws = {};
        states.forEach(state => {
            assessmentStateLaws[state.state_code] = state;
        });
        
        console.log('Loaded state laws:', Object.keys(assessmentStateLaws).length, 'states');
    } catch (error) {
        console.error('Error loading state laws:', error);
    }
}

// Edit assessment questions
async function editAssessment(id) {
    try {
        // Load state laws if not already loaded
        if (Object.keys(assessmentStateLaws).length === 0) {
            await loadStateLaws();
        }
        
        // Load assessment data
        const { data: assessment, error } = await supabase
            .from('assessments')
            .select(`
                *,
                training_modules (
                    module_name,
                    module_code
                )
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        currentAssessment = assessment;
        
        // Parse questions
        currentQuestions = assessment.questions_json || [];
        
        showAssessmentEditorModal();
    } catch (error) {
        console.error('Error loading assessment:', error);
        alert('Error loading assessment: ' + error.message);
    }
}

// Show assessment editor modal
function showAssessmentEditorModal() {
    const isUseOfForce = currentAssessment.training_modules?.module_code === 'use-of-force';
    
    // Generate state selector if this is Use of Force assessment
    const stateSelector = isUseOfForce ? `
        <div style="background: #e3f2fd; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem; border-left: 4px solid #2196F3;">
            <p style="margin: 0 0 0.5rem 0; font-weight: bold; color: #1976D2;">
                <i class="fas fa-map-marker-alt"></i> State-Specific Questions
            </p>
            <p style="margin: 0 0 0.75rem 0; font-size: 0.875rem; color: #555;">
                Select a state to edit its specific Use of Force questions:
            </p>
            <select id="stateSelector" onchange="changeState(this.value)" style="width: 100%; padding: 0.75rem; border: 2px solid #2196F3; border-radius: 0.5rem; font-size: 1rem;">
                <option value="">-- Select a State --</option>
                ${Object.keys(assessmentStateLaws).sort((a, b) => assessmentStateLaws[a].state_name.localeCompare(assessmentStateLaws[b].state_name)).map(code => `
                    <option value="${code}" ${selectedStateCode === code ? 'selected' : ''}>
                        ${assessmentStateLaws[code].state_name} (${code})
                    </option>
                `).join('')}
            </select>
        </div>
    ` : '';
    
    const modalHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-content" style="max-width: 1200px; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h2>Edit Assessment Questions - ${currentAssessment.training_modules?.module_name || currentAssessment.assessment_name}</h2>
                    <button class="close-btn" onclick="closeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div style="background: #f5f5f5; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
                        <p style="margin: 0;"><strong>Total Questions:</strong> ${currentQuestions.length}</p>
                        <p style="margin: 0.5rem 0 0 0;"><strong>Passing Score:</strong> ${currentAssessment.passing_score}%</p>
                    </div>

                    ${stateSelector}

                    <div id="questionsList">
                        ${renderQuestionsList()}
                    </div>

                    <button class="btn btn-secondary" onclick="addNewQuestion()" style="margin-top: 1rem;">
                        <i class="fas fa-plus"></i> Add New Question
                    </button>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="saveAssessmentQuestions()">
                        <i class="fas fa-save"></i> Save Changes
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('modalContainer').innerHTML = modalHTML;
}

// Render questions list
function renderQuestionsList() {
    if (currentQuestions.length === 0) {
        return '<p style="text-align: center; color: #666; padding: 2rem;">No questions yet. Click "Add New Question" to get started.</p>';
    }

    return currentQuestions.map((q, index) => `
        <div class="question-card" style="background: white; border: 1px solid #ddd; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <h4 style="margin: 0; color: #333;">Question ${index + 1}</h4>
                <button class="btn btn-sm btn-danger" onclick="deleteQuestion(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>

            <div class="form-group">
                <label>Question Text</label>
                <textarea 
                    class="form-control" 
                    rows="3" 
                    onchange="updateQuestion(${index}, 'question', this.value)"
                    placeholder="Enter the question..."
                >${q.question || ''}</textarea>
            </div>

            <div class="form-group">
                <label>Answer Options</label>
                ${q.options?.map((option, optIndex) => {
                    const escapedOption = (option || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                    return `
                    <div class="answer-option-row">
                        <input 
                            type="radio" 
                            name="correct_${index}" 
                            ${q.correctAnswer === optIndex ? 'checked' : ''}
                            onchange="updateQuestion(${index}, 'correctAnswer', ${optIndex})"
                            title="Mark as correct answer"
                        >
                        <input 
                            type="text" 
                            class="answer-option-input" 
                            value="${escapedOption}" 
                            onchange="updateQuestionOption(${index}, ${optIndex}, this.value)"
                            placeholder="Option ${optIndex + 1}"
                        >
                    </div>
                `;
                }).join('') || ''}
            </div>

            <div class="form-group">
                <label>Explanation (Optional)</label>
                <textarea 
                    class="form-control" 
                    rows="2" 
                    onchange="updateQuestion(${index}, 'explanation', this.value)"
                    placeholder="Explain why this is the correct answer..."
                >${q.explanation || ''}</textarea>
            </div>
        </div>
    `).join('');
}

// Update question
function updateQuestion(index, field, value) {
    currentQuestions[index][field] = value;
}

// Update question option
function updateQuestionOption(questionIndex, optionIndex, value) {
    if (!currentQuestions[questionIndex].options) {
        currentQuestions[questionIndex].options = [];
    }
    currentQuestions[questionIndex].options[optionIndex] = value;
}

// Add new question
function addNewQuestion() {
    currentQuestions.push({
        question: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        explanation: ''
    });
    
    // Re-render
    document.getElementById('questionsList').innerHTML = renderQuestionsList();
}

// Delete question
function deleteQuestion(index) {
    if (confirm('Are you sure you want to delete this question?')) {
        currentQuestions.splice(index, 1);
        document.getElementById('questionsList').innerHTML = renderQuestionsList();
    }
}

// Change state for Use of Force assessment
async function changeState(stateCode) {
    if (!stateCode) {
        selectedStateCode = null;
        currentQuestions = [];
        document.getElementById('questionsList').innerHTML = renderQuestionsList();
        return;
    }
    
    selectedStateCode = stateCode;
    console.log('Changed to state:', stateCode, assessmentStateLaws[stateCode].state_name);
    
    // Generate state-specific questions based on the selected state
    const stateInfo = assessmentStateLaws[stateCode];
    currentQuestions = generateStateSpecificQuestions(stateInfo, stateCode);
    
    // Refresh the questions list
    document.getElementById('questionsList').innerHTML = renderQuestionsList();
}

// Generate state-specific questions for Use of Force
function generateStateSpecificQuestions(stateInfo, stateCode) {
    return [
        {
            question: `What is the minimum age requirement to work as a security guard in ${stateInfo.state_name}?`,
            options: [
                stateInfo.min_age,
                '16 years old',
                '21 years old',
                '25 years old'
            ],
            correctAnswer: 0,
            explanation: `In ${stateInfo.state_name}, security guards must be at least ${stateInfo.min_age}.`
        },
        {
            question: `What are the training hour requirements for security guards in ${stateInfo.state_name}?`,
            options: [
                stateInfo.training_hours,
                'No training required',
                '40 hours minimum',
                '80 hours minimum'
            ],
            correctAnswer: 0,
            explanation: `${stateInfo.state_name} requires: ${stateInfo.training_hours}`
        },
        {
            question: `What is the licensing requirement for unarmed security guards in ${stateInfo.state_name}?`,
            options: [
                stateInfo.licensing,
                'Federal license required',
                'No license needed',
                'Must be a sworn officer'
            ],
            correctAnswer: 0,
            explanation: `${stateInfo.state_name} licensing: ${stateInfo.licensing}`
        },
        {
            question: `What are the use of force guidelines in ${stateInfo.state_name}?`,
            options: [
                stateInfo.use_of_force,
                'Unlimited force allowed',
                'No force permitted',
                'Only deadly force allowed'
            ],
            correctAnswer: 0,
            explanation: `${stateInfo.state_name} use of force policy: ${stateInfo.use_of_force}`
        },
        {
            question: `What are the citizen's arrest laws in ${stateInfo.state_name}?`,
            options: [
                stateInfo.citizens_arrest,
                'Not permitted',
                'Only for federal crimes',
                'Unlimited authority'
            ],
            correctAnswer: 0,
            explanation: `${stateInfo.state_name} citizen's arrest: ${stateInfo.citizens_arrest}`
        },
        {
            question: `What are the weapons regulations for security guards in ${stateInfo.state_name}?`,
            options: [
                stateInfo.weapons,
                'All weapons permitted',
                'No weapons allowed',
                'Only firearms allowed'
            ],
            correctAnswer: 0,
            explanation: `${stateInfo.state_name} weapons policy: ${stateInfo.weapons}`
        },
        {
            question: `Which agency regulates security guards in ${stateInfo.state_name}?`,
            options: [
                stateInfo.regulatory_agency,
                'FBI',
                'Local police only',
                'No regulation'
            ],
            correctAnswer: 0,
            explanation: `${stateInfo.state_name} is regulated by: ${stateInfo.regulatory_agency}`
        }
    ];
}

// Save assessment questions
async function saveAssessmentQuestions() {
    try {
        // Validate questions
        const validQuestions = currentQuestions.filter(q => {
            return q.question && 
                   q.options && 
                   q.options.length === 4 && 
                   q.options.every(opt => opt.trim() !== '') &&
                   q.correctAnswer !== undefined;
        });

        if (validQuestions.length === 0) {
            alert('Please add at least one complete question with all options filled in.');
            return;
        }

        if (validQuestions.length !== currentQuestions.length) {
            if (!confirm(`${currentQuestions.length - validQuestions.length} incomplete question(s) will be removed. Continue?`)) {
                return;
            }
        }

        // Update assessment
        const { error } = await supabase
            .from('assessments')
            .update({
                questions_json: validQuestions,
                total_questions: validQuestions.length,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentAssessment.id);

        if (error) throw error;

        alert('Assessment questions saved successfully!');
        closeModal();
        await loadAssessments();
    } catch (error) {
        console.error('Error saving assessment:', error);
        alert('Error saving assessment: ' + error.message);
    }
}

// Close modal
function closeModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('modalContainer').innerHTML = '';
    currentAssessment = null;
    currentQuestions = [];
}
