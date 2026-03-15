// Instructor Portal Main JavaScript
let currentInstructor = null;
let currentStudentId = null;
let allStudents = [];
let allClasses = [];

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    const isLoggedIn = await InstructorAuth.isLoggedIn();
    if (!isLoggedIn) {
        window.location.href = 'login.html';
        return;
    }

    currentInstructor = await InstructorAuth.getInstructorProfile();
    if (!currentInstructor) {
        alert('Unable to load instructor profile');
        await InstructorAuth.signOut();
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('instructorName').textContent = `${currentInstructor.first_name} ${currentInstructor.last_name}`;
    initializeNavigation();
    await loadDashboard();
});

// Navigation
function initializeNavigation() {
    document.querySelectorAll('.nav-link[data-section]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            showSection(this.getAttribute('data-section'));
        });
    });
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`.nav-link[data-section="${sectionId}"]`)?.classList.add('active');
    loadSectionData(sectionId);
}

async function loadSectionData(sectionId) {
    const loaders = {
        dashboard: loadDashboard,
        students: loadStudents,
        classes: loadClasses,
        certificates: loadCertificates
    };
    if (loaders[sectionId]) await loaders[sectionId]();
}

// Dashboard
async function loadDashboard() {
    try {
        const studentsResult = await StudentData.getAllStudents();
        document.getElementById('totalStudents').textContent = studentsResult.success ? studentsResult.data.length : 0;

        const classesResult = await ClassManagement.getInstructorClasses(currentInstructor.id, 
            { status: 'scheduled', startDate: new Date().toISOString().split('T')[0] });
        document.getElementById('upcomingClasses').textContent = classesResult.success ? classesResult.data.length : 0;

        const today = new Date().toISOString().split('T')[0];
        const todayResult = await ClassManagement.getInstructorClasses(currentInstructor.id,
            { status: 'scheduled', startDate: today, endDate: today });
        document.getElementById('todayClasses').textContent = todayResult.success ? todayResult.data.length : 0;

        const { data: certs } = await supabase.from('certificates').select('id').eq('issued_by', currentInstructor.id);
        document.getElementById('certificatesIssued').textContent = certs ? certs.length : 0;

        await loadUpcomingClasses();
    } catch (error) {
        console.error('Dashboard error:', error);
    }
}

async function loadUpcomingClasses() {
    const container = document.getElementById('upcomingClassesList');
    const result = await ClassManagement.getInstructorClasses(currentInstructor.id, 
        { status: 'scheduled', startDate: new Date().toISOString().split('T')[0] });

    if (!result.success || result.data.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-times"></i><h3>No Upcoming Classes</h3></div>';
        return;
    }

    const classes = result.data.sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date)).slice(0, 5);
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Class Name</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Enrolled</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${classes.map(cls => `
                    <tr>
                        <td><strong>${cls.class_name}</strong><br><small>${cls.class_type}</small></td>
                        <td>${formatDate(cls.scheduled_date)}</td>
                        <td>${formatTime(cls.start_time)}</td>
                        <td>${cls.enrollments?.[0]?.count || 0} / ${cls.capacity}</td>
                        <td>
                            <div class="table-actions-cell">
                                <button class="action-btn view" onclick="viewClassDetails('${cls.id}')">
                                    <i class="fas fa-eye"></i> View
                                </button>
                                <button class="action-btn delete" onclick="deleteClass('${cls.id}', '${cls.class_name}')">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Students
async function loadStudents() {
    const tbody = document.getElementById('studentsTableBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:3rem;"><div class="loading-spinner"></div></td></tr>';
    const result = await StudentData.getAllStudents();
    allStudents = result.success ? result.data : [];
    renderStudentsTable(allStudents);
}

function renderStudentsTable(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><h3>No Students Found</h3></div></td></tr>';
        return;
    }
    tbody.innerHTML = students.map(s => {
        const progress = s.progress?.[0]?.count || 0;
        const certs = s.certificates?.[0]?.count || 0;
        return `<tr><td><strong>${s.first_name} ${s.last_name}</strong></td><td>${s.email}</td>
        <td><div class="progress-bar"><div class="progress-fill" style="width:${(progress/7)*100}%">${progress}/7</div></div></td>
        <td><span class="badge badge-${certs > 0 ? 'success' : 'warning'}">${certs}</span></td>
        <td><button class="action-btn view" onclick="viewStudentDetails('${s.id}')"><i class="fas fa-eye"></i></button></td></tr>`;
    }).join('');
}

function searchStudents() {
    const term = document.getElementById('studentSearch').value.toLowerCase();
    const filtered = term ? allStudents.filter(s => 
        s.first_name.toLowerCase().includes(term) || s.last_name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term)
    ) : allStudents;
    renderStudentsTable(filtered);
}

async function viewStudentDetails(studentId) {
    currentStudentId = studentId;
    const result = await StudentData.getStudentDetails(studentId);
    if (!result.success) return;
    const s = result.data;
    document.getElementById('studentDetailsBody').innerHTML = `<div class="student-profile">
        <div class="profile-header"><div class="profile-avatar">${s.first_name[0]}${s.last_name[0]}</div>
        <div class="profile-info"><h2>${s.first_name} ${s.last_name}</h2><p>${s.email}</p></div></div>
        <h3>Progress</h3>${s.progress?.length ? `<table><thead><tr><th>Module</th><th>Progress</th><th>Status</th></tr></thead><tbody>
        ${s.progress.map(p => `<tr><td>${p.module?.module_name}</td><td><div class="progress-bar"><div class="progress-fill" style="width:${p.progress_percentage}%">${p.progress_percentage}%</div></div></td>
        <td><span class="badge badge-${p.status === 'completed' ? 'success' : 'warning'}">${p.status}</span></td></tr>`).join('')}</tbody></table>` : '<p>No progress</p>'}
        <h3>Certificates</h3>${s.certificates?.length ? `<table><tbody>${s.certificates.map(c => 
        `<tr><td>${c.certificate_number}</td><td>${c.certificate_name}</td><td>${formatDate(c.issue_date)}</td></tr>`).join('')}</tbody></table>` : '<p>No certificates</p>'}
    </div>`;
    document.getElementById('studentDetailsModal').classList.add('active');
}

function closeStudentDetailsModal() {
    document.getElementById('studentDetailsModal').classList.remove('active');
}

// Classes
async function loadClasses() {
    const grid = document.getElementById('classesGrid');
    grid.innerHTML = '<div style="text-align:center;padding:3rem;"><div class="loading-spinner"></div></div>';
    const result = await ClassManagement.getInstructorClasses(currentInstructor.id);
    allClasses = result.success ? result.data : [];
    renderClassesGrid(allClasses);
}

function renderClassesGrid(classes) {
    const grid = document.getElementById('classesGrid');
    if (classes.length === 0) {
        grid.innerHTML = '<div class="empty-state"><h3>No Classes</h3><button class="btn btn-primary" onclick="showCreateClassModal()"><i class="fas fa-plus"></i> Schedule Class</button></div>';
        return;
    }
    grid.innerHTML = classes.map(c => `<div class="card"><div class="card-header"><h3>${c.class_name}</h3><span class="badge badge-primary">${c.status}</span></div>
        <div class="card-body"><p><i class="fas fa-calendar"></i> ${formatDate(c.scheduled_date)}</p><p><i class="fas fa-clock"></i> ${formatTime(c.start_time)} (${c.duration_hours}h)</p>
        <p><i class="fas fa-users"></i> ${c.enrollments?.[0]?.count || 0}/${c.capacity}</p></div>
        <div class="card-footer">
            <button class="btn btn-outline" onclick="viewClassDetails('${c.id}')"><i class="fas fa-eye"></i> View</button>
            ${c.status === 'scheduled' ? `<button class="btn btn-outline" style="color: var(--secondary); border-color: var(--secondary);" onclick="deleteClass('${c.id}', '${c.class_name}')"><i class="fas fa-trash"></i> Delete</button>` : ''}
        </div></div>`).join('');
}

function filterClasses() {
    const filter = document.getElementById('classFilter').value;
    renderClassesGrid(filter === 'all' ? allClasses : allClasses.filter(c => c.status === filter));
}

function showCreateClassModal() {
    document.getElementById('classForm').reset();
    document.getElementById('classId').value = '';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('classDate').value = tomorrow.toISOString().split('T')[0];
    document.getElementById('classModal').classList.add('active');
}

function closeClassModal() {
    document.getElementById('classModal').classList.remove('active');
}

async function saveClass() {
    const data = {
        class_name: document.getElementById('className').value,
        class_type: document.getElementById('classType').value,
        scheduled_date: document.getElementById('classDate').value,
        start_time: document.getElementById('classTime').value,
        duration_hours: parseFloat(document.getElementById('classDuration').value),
        capacity: parseInt(document.getElementById('classCapacity').value),
        location: document.getElementById('classLocation').value || null,
        meeting_link: document.getElementById('meetingLink').value || null,
        description: document.getElementById('classDescription').value || null
    };
    const startTime = new Date(`2000-01-01 ${data.start_time}`);
    startTime.setHours(startTime.getHours() + Math.floor(data.duration_hours));
    data.end_time = startTime.toTimeString().slice(0, 5);
    
    const result = await ClassManagement.createClass(currentInstructor.id, data);
    if (result.success) {
        showAlert('Class created!', 'success');
        closeClassModal();
        loadClasses();
        loadDashboard();
    }
}

async function viewClassDetails(classId) {
    const result = await ClassManagement.getClassDetails(classId);
    if (!result.success) return;
    const c = result.data;
    const enrollments = c.enrollments || [];
    const canAddStudents = c.status === 'scheduled' && enrollments.length < c.capacity;
    
    document.getElementById('classDetailsBody').innerHTML = `
        <div>
            <div style="margin-bottom: 2rem; padding: 2rem; background: var(--instructor-light); border-radius: 8px;">
                <h3 style="margin-top: 0;">${c.class_name}</h3>
                <p><strong>Type:</strong> ${c.class_type}</p>
                <p><strong>Date:</strong> ${formatDate(c.scheduled_date)}</p>
                <p><strong>Time:</strong> ${formatTime(c.start_time)} - ${formatTime(c.end_time)}</p>
                <p><strong>Duration:</strong> ${c.duration_hours} hour${c.duration_hours !== 1 ? 's' : ''}</p>
                ${c.location ? `<p><strong>Location:</strong> ${c.location}</p>` : '<p><strong>Location:</strong> <em>Not specified</em></p>'}
                ${c.meeting_link ? `<p><strong>Meeting Link:</strong> <a href="${c.meeting_link}" target="_blank" style="color: var(--secondary-color);">${c.meeting_link}</a></p>` : ''}
                ${c.description ? `<p><strong>Description:</strong> ${c.description}</p>` : ''}
                <p><strong>Capacity:</strong> ${enrollments.length} / ${c.capacity}</p>
                <p><strong>Status:</strong> <span class="badge badge-primary">${c.status}</span></p>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin: 2rem 0 1rem 0;">
                <h4 style="margin: 0;">Enrolled Students (${enrollments.length})</h4>
                ${canAddStudents ? `<button class="btn btn-primary" onclick="showAddStudentsModal('${classId}', '${c.class_name.replace(/'/g, "&apos;")}')">
                    <i class="fas fa-user-plus"></i> Add Students
                </button>` : ''}
            </div>
            ${enrollments.length ? `<table><thead><tr><th>Student</th><th>Email</th><th>Actions</th></tr></thead><tbody>
            ${enrollments.map(e => `<tr><td>${e.student?.first_name} ${e.student?.last_name}</td><td>${e.student?.email}</td>
            <td><button class="action-btn delete" onclick="removeStudentFromClass('${classId}', '${e.student_id}')"><i class="fas fa-times"></i> Remove</button></td></tr>`).join('')}</tbody></table>` : '<p>No enrollments</p>'}
        </div>`;
    document.getElementById('classDetailsModal').classList.add('active');
}

async function removeStudentFromClass(classId, studentId) {
    if (!confirm('Remove this student from the class?')) return;
    const result = await EnrollmentManagement.removeStudent(classId, studentId);
    if (result.success) {
        showAlert('Student removed', 'success');
        await viewClassDetails(classId);
    } else {
        showAlert('Error removing student', 'danger');
    }
}

function closeClassDetailsModal() {
    document.getElementById('classDetailsModal').classList.remove('active');
}

async function deleteClass(classId, className) {
    if (!confirm(`Are you sure you want to delete the class "${className}"?\n\nThis will also remove all student enrollments for this class.`)) {
        return;
    }
    
    try {
        const result = await ClassManagement.deleteClass(classId);
        
        if (result.success) {
            showAlert('Class deleted successfully!', 'success');
            await loadClasses();
            await loadDashboard();
        } else {
            showAlert(result.error || 'Error deleting class', 'danger');
        }
    } catch (error) {
        console.error('Error deleting class:', error);
        showAlert('Error deleting class', 'danger');
    }
}

// Certificates
async function loadCertificates() {
    document.getElementById('eligibleStudentsList').innerHTML = '<div class="empty-state"><h3>Check student progress to determine eligibility</h3></div>';
    const tbody = document.getElementById('certificatesTableBody');
    const { data } = await supabase.from('certificates').select(`*, student:students(first_name, last_name)`).eq('issued_by', currentInstructor.id);
    tbody.innerHTML = data?.length ? data.map(c => `<tr><td>${c.certificate_number}</td><td>${c.student?.first_name} ${c.student?.last_name}</td>
        <td>${c.certificate_type}</td><td>${formatDate(c.issue_date)}</td><td><span class="badge badge-success">${c.status}</span></td><td></td></tr>`).join('') 
        : '<tr><td colspan="6"><div class="empty-state"><h3>No Certificates Issued</h3></div></td></tr>';
}

async function checkAllEligibility() {
    await loadCertificates();
}

function searchCertificates() {
    // Implement certificate search
}

function showIssueCertificateModal() {
    document.getElementById('certStudentId').value = currentStudentId;
    closeStudentDetailsModal();
    document.getElementById('issueCertificateModal').classList.add('active');
}

function closeIssueCertificateModal() {
    document.getElementById('issueCertificateModal').classList.remove('active');
}

async function issueCertificate() {
    const studentId = document.getElementById('certStudentId').value;
    const data = {
        certificate_type: document.getElementById('certificateType').value,
        certificate_name: document.getElementById('certificateName').value,
        state_issued: document.getElementById('stateIssued').value || null,
        expiration_date: document.getElementById('expirationDate').value || null,
        notes: document.getElementById('certificateNotes').value || null
    };
    const result = await CertificateManagement.issueCertificate(studentId, currentInstructor.id, data);
    if (result.success) {
        showAlert('Certificate issued successfully!', 'success');
        closeIssueCertificateModal();
        loadCertificates();
    } else {
        showAlert(result.error, 'danger');
    }
}

// Utilities
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(timeString) {
    const [h, m] = timeString.split(':');
    const hour = parseInt(h);
    return `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function showAlert(message, type) {
    alert(message);
}

async function logout() {
    if (confirm('Are you sure you want to log out?')) {
        await InstructorAuth.signOut();
        window.location.href = 'login.html';
    }
}

function showProfileTab(tab) {
    document.querySelectorAll('.profile-tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.profile-tab').forEach(b => b.classList.remove('active'));
    document.getElementById(`${tab}Tab`).classList.add('active');
    event.target.classList.add('active');
}
