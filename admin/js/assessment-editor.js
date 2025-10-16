// Assessment Editor Functions

let currentAssessment = null;
let currentQuestions = [];

// Load all assessments
async function loadAssessments() {
    try {
        const { data: assessments, error } = await supabase
            .from('assessments')
            .select(`
                *,
                training_modules (
                    module_name,
                    module_code,
                    display_order
                )
            `)
            .order('training_modules(display_order)', { ascending: true });

        if (error) throw error;

        displayAssessments(assessments || []);
    } catch (error) {
        console.error('Error loading assessments:', error);
        document.getElementById('assessmentsList').innerHTML = '<p class="error">Error loading assessments</p>';
    }
}

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

// Edit assessment questions
async function editAssessment(id) {
    try {
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
