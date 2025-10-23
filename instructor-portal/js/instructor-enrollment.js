// Student Enrollment Functions for Instructor Portal

async function showAddStudentsModal(classId, className) {
    document.getElementById('targetClassId').value = classId;
    document.getElementById('targetClassName').value = className;
    
    // Get class details to know who's already enrolled
    const classResult = await ClassManagement.getClassDetails(classId);
    const enrolledStudentIds = classResult.success ? 
        (classResult.data.enrollments || []).map(e => e.student_id) : [];
    
    // Get all students
    const studentsResult = await StudentData.getAllStudents();
    
    if (!studentsResult.success || studentsResult.data.length === 0) {
        document.getElementById('studentsListForEnrollment').innerHTML = 
            '<div class="empty-state"><h3>No Students Found</h3></div>';
        document.getElementById('addStudentsModal').classList.add('active');
        return;
    }
    
    // Filter out already enrolled students
    const availableStudents = studentsResult.data.filter(s => !enrolledStudentIds.includes(s.id));
    
    if (availableStudents.length === 0) {
        document.getElementById('studentsListForEnrollment').innerHTML = 
            '<div class="empty-state"><h3>All Students Already Enrolled</h3></div>';
        document.getElementById('addStudentsModal').classList.add('active');
        return;
    }
    
    // Render student list with completion status
    renderStudentSelectionList(availableStudents);
    document.getElementById('addStudentsModal').classList.add('active');
}

function renderStudentSelectionList(students) {
    const container = document.getElementById('studentsListForEnrollment');
    
    container.innerHTML = students.map(s => {
        const progressCount = s.progress?.[0]?.count || 0;
        const isComplete = progressCount >= 7;
        
        return `
            <div style="border: 2px solid #e0e0e0; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; cursor: pointer; transition: all 0.3s;" 
                 onclick="toggleStudentSelection('${s.id}', this)">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <input type="checkbox" class="student-checkbox" data-student-id="${s.id}" style="width: 20px; height: 20px; cursor: pointer;">
                        <div>
                            <strong style="font-size: 1.6rem;">${s.first_name} ${s.last_name}</strong>
                            <div style="color: var(--gray); font-size: 1.4rem;">${s.email}</div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="margin-bottom: 0.5rem;">
                            <span class="badge ${isComplete ? 'badge-success' : 'badge-warning'}">
                                ${isComplete ? '<i class="fas fa-check-circle"></i> All Modules Complete' : `${progressCount}/7 Modules`}
                            </span>
                        </div>
                        <div style="font-size: 1.2rem; color: var(--gray);">
                            ${s.certificates?.[0]?.count || 0} Certificate${s.certificates?.[0]?.count !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleStudentSelection(studentId, element) {
    const checkbox = element.querySelector('.student-checkbox');
    checkbox.checked = !checkbox.checked;
    element.style.borderColor = checkbox.checked ? 'var(--secondary-color)' : '#e0e0e0';
    element.style.backgroundColor = checkbox.checked ? 'var(--instructor-light)' : 'white';
}

function filterStudentsInModal() {
    const searchTerm = document.getElementById('studentSearchInModal').value.toLowerCase();
    const studentDivs = document.querySelectorAll('#studentsListForEnrollment > div');
    
    studentDivs.forEach(div => {
        const text = div.textContent.toLowerCase();
        div.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
}

async function enrollSelectedStudents() {
    const classId = document.getElementById('targetClassId').value;
    const className = document.getElementById('targetClassName').value;
    const checkboxes = document.querySelectorAll('.student-checkbox:checked');
    
    if (checkboxes.length === 0) {
        alert('Please select at least one student to enroll');
        return;
    }
    
    const selectedStudentIds = Array.from(checkboxes).map(cb => cb.dataset.studentId);
    
    // Show loading state
    const enrollButton = event.target;
    enrollButton.disabled = true;
    enrollButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enrolling...';
    
    try {
        let successCount = 0;
        let failCount = 0;
        
        for (const studentId of selectedStudentIds) {
            const result = await EnrollmentManagement.enrollStudent(classId, studentId);
            
            if (result.success) {
                successCount++;
                // Send email notification
                await sendEnrollmentEmail(studentId, classId, className);
            } else {
                failCount++;
            }
        }
        
        if (successCount > 0) {
            showAlert(`Successfully enrolled ${successCount} student${successCount !== 1 ? 's' : ''} and sent email notifications!`, 'success');
        }
        if (failCount > 0) {
            showAlert(`Failed to enroll ${failCount} student${failCount !== 1 ? 's' : ''}`, 'danger');
        }
        
        closeAddStudentsModal();
        await viewClassDetails(classId); // Refresh class details
        await loadDashboard(); // Refresh dashboard
        
    } catch (error) {
        console.error('Error enrolling students:', error);
        showAlert('Error enrolling students', 'danger');
        enrollButton.disabled = false;
        enrollButton.innerHTML = '<i class="fas fa-user-plus"></i> Enroll Selected Students';
    }
}

async function sendEnrollmentEmail(studentId, classId, className) {
    try {
        // Get student details
        const studentResult = await StudentData.getStudentDetails(studentId);
        if (!studentResult.success) return;
        
        const student = studentResult.data;
        
        // Get class details
        const classResult = await ClassManagement.getClassDetails(classId);
        if (!classResult.success) return;
        
        const classInfo = classResult.data;
        
        // Create email content
        const emailData = {
            to: student.email,
            subject: `Enrolled: ${className} - Evenfall Advantage`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #f39c12;">You've been enrolled in a class!</h2>
                    <p>Hello ${student.first_name},</p>
                    <p>You have been enrolled in the following class:</p>
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f39c12;">
                        <h3 style="margin-top: 0; color: #253646;">${classInfo.class_name}</h3>
                        <p><strong>Type:</strong> ${classInfo.class_type}</p>
                        <p><strong>Date:</strong> ${formatDate(classInfo.scheduled_date)}</p>
                        <p><strong>Time:</strong> ${formatTime(classInfo.start_time)} - ${formatTime(classInfo.end_time)}</p>
                        <p><strong>Duration:</strong> ${classInfo.duration_hours} hours</p>
                        ${classInfo.location ? `<p><strong>Location:</strong> ${classInfo.location}</p>` : ''}
                        ${classInfo.meeting_link ? `<p><strong>Meeting Link:</strong> <a href="${classInfo.meeting_link}" style="color: #f39c12;">${classInfo.meeting_link}</a></p>` : ''}
                        ${classInfo.description ? `<p><strong>Description:</strong> ${classInfo.description}</p>` : ''}
                    </div>
                    <p>Please log in to your student portal to view more details and manage your schedule.</p>
                    <p style="margin-top: 30px;">Best regards,<br><strong>Evenfall Advantage Team</strong></p>
                </div>
            `
        };
        
        // Send email via direct fetch to Edge Function (bypasses Supabase client auth)
        console.log('📧 Sending email notification to:', emailData.to);
        
        try {
            const response = await fetch('https://vaagvairvwmgyzsmymhs.supabase.co/functions/v1/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhYWd2YWlydndtZ3l6c215bWhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NjAzNTcsImV4cCI6MjA3NTMzNjM1N30.wCw2rcV2pJTXiKgKJE9BY3QHBWiRHgGPfdDPIeUsovM'
                },
                body: JSON.stringify(emailData)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                console.error('❌ Email send error:', response.status, data);
            } else {
                console.log('✅ Email sent successfully:', data);
            }
        } catch (error) {
            console.error('❌ Email send error:', error);
        }
        
    } catch (error) {
        console.error('Error preparing enrollment email:', error);
    }
}

function closeAddStudentsModal() {
    document.getElementById('addStudentsModal').classList.remove('active');
    document.getElementById('studentSearchInModal').value = '';
}

// Make functions globally available
window.showAddStudentsModal = showAddStudentsModal;
window.toggleStudentSelection = toggleStudentSelection;
window.filterStudentsInModal = filterStudentsInModal;
window.enrollSelectedStudents = enrollSelectedStudents;
window.closeAddStudentsModal = closeAddStudentsModal;
