// Admin Dashboard JavaScript

// Check authentication on load
window.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded');
    try {
        await checkAuth();
        console.log('Auth check complete');
        await loadDashboardData();
        console.log('Dashboard data loaded');
        setupEventListeners();
        console.log('Setup complete');
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

// Show alert message
function showAlert(message, type = 'info') {
    // Remove existing alerts
    document.querySelectorAll('.alert-message').forEach(el => el.remove());
    
    const alertHTML = `
        <div class="alert-message ${type}">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    const activeSection = document.querySelector('.admin-section.active');
    if (activeSection) {
        activeSection.insertAdjacentHTML('afterbegin', alertHTML);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            document.querySelector('.alert-message')?.remove();
        }, 5000);
    }
}

// Check if user is authenticated admin
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Verify admin status
    const { data: adminData, error } = await supabase
        .from('administrators')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (error || !adminData) {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
        return;
    }

    // Display admin name
    document.getElementById('adminName').textContent = adminData.first_name + ' ' + adminData.last_name;
}

// Logout function
async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    try {
        // Navigation
        const navItems = document.querySelectorAll('.nav-item');
        console.log('Found nav items:', navItems.length);
        
        if (navItems.length === 0) {
            console.error('WARNING: No nav items found!');
            return;
        }
        
        navItems.forEach((item, index) => {
            console.log(`Setting up nav item ${index}:`, item.dataset.section);
            item.addEventListener('click', function(e) {
                e.preventDefault();
                const section = this.dataset.section;
                console.log('Nav clicked:', section);
                switchSection(section);
            });
        });

        // Search functionality
        const studentSearch = document.getElementById('studentSearch');
        if (studentSearch) {
            studentSearch.addEventListener('input', (e) => {
                filterStudents(e.target.value);
            });
        }

        const clientSearch = document.getElementById('clientSearch');
        if (clientSearch) {
            clientSearch.addEventListener('input', (e) => {
                filterClients(e.target.value);
            });
        }

        const certSearch = document.getElementById('certSearch');
        if (certSearch) {
            certSearch.addEventListener('input', (e) => {
                filterCertificates(e.target.value);
            });
        }

        const certCategoryFilter = document.getElementById('certCategoryFilter');
        if (certCategoryFilter) {
            certCategoryFilter.addEventListener('change', (e) => {
                filterCertificatesByCategory(e.target.value);
            });
        }
        
        console.log('Event listeners setup complete');
    } catch (error) {
        console.error('Error setting up event listeners:', error);
    }
}

// Switch between sections
function switchSection(sectionName) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === sectionName) {
            item.classList.add('active');
        }
    });

    // Update sections
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`${sectionName}-section`).classList.add('active');

    // Load section data
    loadSectionData(sectionName);
}

// Load dashboard data
async function loadDashboardData() {
    await Promise.all([
        loadOverviewStats(),
        loadStudents(),
        loadClients(),
        loadCertificates(),
        loadRosters(),
        loadCourses()
    ]);
}

// Load overview statistics
async function loadOverviewStats() {
    try {
        // Get total students
        const { count: studentCount, error: studentError } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true });

        if (studentError) {
            console.error('Error loading student count:', studentError);
        }

        // Get total clients
        const { count: clientCount, error: clientError } = await supabase
            .from('clients')
            .select('*', { count: 'exact', head: true });

        if (clientError) {
            console.error('Error loading client count:', clientError);
        }

        // Get total certificates
        const { count: certCount, error: certError } = await supabase
            .from('certifications')
            .select('*', { count: 'exact', head: true });

        if (certError) {
            console.error('Error loading certificate count:', certError);
        }

        // Get active courses (assuming you have a courses table)
        const { count: courseCount, error: courseError } = await supabase
            .from('modules')
            .select('*', { count: 'exact', head: true });

        if (courseError) {
            console.error('Error loading course count:', courseError);
        }

        document.getElementById('totalStudents').textContent = studentCount || 0;
        document.getElementById('totalClients').textContent = clientCount || 0;
        document.getElementById('totalCertificates').textContent = certCount || 0;
        document.getElementById('activeCourses').textContent = courseCount || 0;

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load students
async function loadStudents() {
    try {
        const { data: students, error } = await supabase
            .from('students')
            .select(`
                *,
                student_profiles(*)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        displayStudents(students);
    } catch (error) {
        console.error('Error loading students:', error);
    }
}

// Display students in table
function displayStudents(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;

    if (!students || students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No students found</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(student => {
        const profile = student.student_profiles?.[0] || {};
        return `
            <tr data-student-id="${student.id}">
                <td>${student.first_name} ${student.last_name}</td>
                <td>${student.email}</td>
                <td>${profile.phone || 'N/A'}</td>
                <td>${new Date(student.created_at).toLocaleDateString()}</td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                </td>
                <td class="table-actions">
                    <button class="btn-icon" onclick="viewStudent('${student.id}')" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="editStudent('${student.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon danger" onclick="deleteStudent('${student.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Load clients
async function loadClients() {
    try {
        const { data: clients, error } = await supabase
            .from('clients')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        displayClients(clients);
    } catch (error) {
        console.error('Error loading clients:', error);
    }
}

// Display clients in table
function displayClients(clients) {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;

    if (!clients || clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No clients found</td></tr>';
        return;
    }

    tbody.innerHTML = clients.map(client => `
        <tr data-client-id="${client.id}">
            <td>${client.company_name}</td>
            <td>${client.first_name} ${client.last_name}</td>
            <td>${client.email}</td>
            <td>${client.phone || 'N/A'}</td>
            <td><span class="badge badge-success">Active</span></td>
            <td class="table-actions">
                <button class="btn-icon" onclick="viewClient('${client.id}')" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-icon" onclick="editClient('${client.id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon danger" onclick="deleteClient('${client.id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Load certificates
async function loadCertificates() {
    try {
        const { data: certificates, error } = await supabase
            .from('certifications')
            .select(`
                *,
                students(first_name, last_name)
            `)
            .order('issue_date', { ascending: false });

        if (error) throw error;

        displayCertificates(certificates);
    } catch (error) {
        console.error('Error loading certificates:', error);
    }
}

// Display certificates in table
function displayCertificates(certificates) {
    const tbody = document.getElementById('certificatesTableBody');
    if (!tbody) return;

    if (!certificates || certificates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No certificates found</td></tr>';
        return;
    }

    tbody.innerHTML = certificates.map(cert => `
        <tr data-cert-id="${cert.id}">
            <td>${cert.students?.first_name} ${cert.students?.last_name}</td>
            <td>${cert.name}</td>
            <td><span class="badge badge-${getCategoryColor(cert.category)}">${cert.category}</span></td>
            <td>${new Date(cert.issue_date).toLocaleDateString()}</td>
            <td>${cert.expiry_date ? new Date(cert.expiry_date).toLocaleDateString() : 'N/A'}</td>
            <td class="table-actions">
                <button class="btn-icon" onclick="viewCertificate('${cert.id}')" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-icon danger" onclick="revokeCertificate('${cert.id}')" title="Revoke">
                    <i class="fas fa-ban"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Helper function for category colors
function getCategoryColor(category) {
    const colors = {
        'Fire': 'danger',
        'Medical': 'success',
        'LEO': 'primary',
        'Military': 'warning',
        'Security': 'info'
    };
    return colors[category] || 'secondary';
}

// Load rosters
async function loadRosters() {
    // Placeholder - implement based on your roster structure
    const rosterList = document.getElementById('rosterList');
    if (!rosterList) return;

    rosterList.innerHTML = `
        <div class="roster-card">
            <h3>Basic Security Training - Fall 2025</h3>
            <div class="roster-date">
                <i class="fas fa-calendar"></i> Oct 15, 2025 - Dec 20, 2025
            </div>
            <div class="roster-stats">
                <div class="roster-stat">
                    <i class="fas fa-users"></i> 24 Students
                </div>
                <div class="roster-stat">
                    <i class="fas fa-check-circle"></i> 18 Present
                </div>
            </div>
            <button class="btn btn-primary btn-small" onclick="manageRoster('1')">
                Manage Roster
            </button>
        </div>
    `;
}

// Load courses
async function loadCourses() {
    try {
        const { data: modules, error } = await supabase
            .from('modules')
            .select('*')
            .order('module_order');

        if (error) throw error;

        displayCourses(modules);
    } catch (error) {
        console.error('Error loading courses:', error);
    }
}

// Display courses
function displayCourses(courses) {
    const grid = document.getElementById('coursesGrid');
    if (!grid) return;

    if (!courses || courses.length === 0) {
        grid.innerHTML = '<p>No courses found</p>';
        return;
    }

    grid.innerHTML = courses.map(course => `
        <div class="course-card">
            <div class="course-card-header">
                <h3>${course.title}</h3>
            </div>
            <div class="course-card-body">
                <p>${course.description || 'No description available'}</p>
                <div class="course-meta">
                    <span><i class="fas fa-clock"></i> ${course.estimated_time || 'N/A'}</span>
                    <span><i class="fas fa-users"></i> 0 enrolled</span>
                </div>
                <button class="btn btn-secondary btn-small" onclick="editCourse('${course.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
            </div>
        </div>
    `).join('');
}

// Load section data when switching
function loadSectionData(section) {
    switch(section) {
        case 'overview':
            loadOverviewStats();
            break;
        case 'students':
            loadStudents();
            break;
        case 'clients':
            loadClients();
            break;
        case 'certificates':
            loadCertificates();
            break;
        case 'attendance':
            loadRosters();
            break;
        case 'courses':
            loadCourses();
            break;
    }
}

// Filter functions
function filterStudents(query) {
    const rows = document.querySelectorAll('#studentsTableBody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
    });
}

function filterClients(query) {
    const rows = document.querySelectorAll('#clientsTableBody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
    });
}

function filterCertificates(query) {
    const rows = document.querySelectorAll('#certificatesTableBody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
    });
}

function filterCertificatesByCategory(category) {
    const rows = document.querySelectorAll('#certificatesTableBody tr');
    rows.forEach(row => {
        if (!category) {
            row.style.display = '';
        } else {
            const text = row.textContent;
            row.style.display = text.includes(category) ? '' : 'none';
        }
    });
}

// Modal functions
function showCreateStudentModal() {
    const modalHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h2>Create Student Account</h2>
                    <button class="close-btn" onclick="closeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="createStudentForm" onsubmit="createStudent(event)">
                        <div class="form-group">
                            <label>First Name *</label>
                            <input type="text" name="first_name" required>
                        </div>
                        <div class="form-group">
                            <label>Last Name *</label>
                            <input type="text" name="last_name" required>
                        </div>
                        <div class="form-group">
                            <label>Email *</label>
                            <input type="email" name="email" required>
                        </div>
                        <div class="form-group">
                            <label>Phone</label>
                            <input type="tel" name="phone">
                        </div>
                        <div class="form-group">
                            <label>Temporary Password *</label>
                            <input type="password" name="password" required minlength="8">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                            <button type="submit" class="btn btn-primary">Create Student</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function showCreateClientModal() {
    const modalHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h2>Create Client Account</h2>
                    <button class="close-btn" onclick="closeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="createClientForm" onsubmit="createClient(event)">
                        <div class="form-group">
                            <label>Company Name *</label>
                            <input type="text" name="company_name" required>
                        </div>
                        <div class="form-group">
                            <label>First Name *</label>
                            <input type="text" name="first_name" required>
                        </div>
                        <div class="form-group">
                            <label>Last Name *</label>
                            <input type="text" name="last_name" required>
                        </div>
                        <div class="form-group">
                            <label>Email *</label>
                            <input type="email" name="email" required>
                        </div>
                        <div class="form-group">
                            <label>Phone *</label>
                            <input type="tel" name="phone" required>
                        </div>
                        <div class="form-group">
                            <label>Temporary Password *</label>
                            <input type="password" name="password" required minlength="8">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                            <button type="submit" class="btn btn-primary">Create Client</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function showIssueCertificateModal() {
    const modalHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h2>Issue Certificate</h2>
                    <button class="close-btn" onclick="closeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="issueCertForm" onsubmit="issueCertificate(event)">
                        <div class="form-group">
                            <label>Student *</label>
                            <select name="student_id" required id="studentSelect">
                                <option value="">Select student...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Certificate Name *</label>
                            <input type="text" name="name" required>
                        </div>
                        <div class="form-group">
                            <label>Category *</label>
                            <select name="category" required>
                                <option value="">Select category...</option>
                                <option value="Fire">Fire</option>
                                <option value="Medical">Medical</option>
                                <option value="LEO">Law Enforcement</option>
                                <option value="Military">Military</option>
                                <option value="Security">Security</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Issuing Organization *</label>
                            <input type="text" name="issuing_organization" required>
                        </div>
                        <div class="form-group">
                            <label>Issue Date *</label>
                            <input type="date" name="issue_date" required>
                        </div>
                        <div class="form-group">
                            <label>Expiry Date</label>
                            <input type="date" name="expiry_date">
                        </div>
                        <div class="form-group">
                            <label>Credential ID</label>
                            <input type="text" name="credential_id">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                            <button type="submit" class="btn btn-primary">Issue Certificate</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Load students for dropdown
    loadStudentsForSelect();
}

async function loadStudentsForSelect() {
    const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .order('last_name');

    const select = document.getElementById('studentSelect');
    if (select && students) {
        students.forEach(student => {
            const option = document.createElement('option');
            option.value = student.id;
            option.textContent = `${student.first_name} ${student.last_name}`;
            select.appendChild(option);
        });
    }
}

function closeModal(event) {
    if (event && event.target.classList.contains('modal-content')) return;
    document.querySelector('.modal-overlay')?.remove();
}

// CRUD operations
async function createStudent(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Creating...';

    try {
        // Note: Since we can't use admin API from frontend, we'll use regular signup
        // The user will need to confirm their email or you can manually confirm in Supabase
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
                data: {
                    first_name: data.first_name,
                    last_name: data.last_name,
                    user_type: 'student'
                }
            }
        });

        if (authError) throw authError;

        // The students table should auto-populate via database trigger
        // But we'll also create the profile
        if (authData.user) {
            await supabase
                .from('student_profiles')
                .insert({
                    student_id: authData.user.id,
                    phone: data.phone || null
                });
        }

        showAlert('Student created successfully! They will need to confirm their email.', 'success');
        closeModal();
        setTimeout(() => loadStudents(), 1000);

    } catch (error) {
        console.error('Error creating student:', error);
        showAlert('Error creating student: ' + error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Create Student';
    }
}

async function createClient(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Creating...';

    try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
                data: {
                    first_name: data.first_name,
                    last_name: data.last_name,
                    company_name: data.company_name,
                    user_type: 'client'
                }
            }
        });

        if (authError) throw authError;

        // The clients table should auto-populate via database trigger
        showAlert('Client created successfully! They will need to confirm their email.', 'success');
        closeModal();
        setTimeout(() => loadClients(), 1000);

    } catch (error) {
        console.error('Error creating client:', error);
        showAlert('Error creating client: ' + error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Create Client';
    }
}

async function issueCertificate(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Issuing...';

    try {
        const { error } = await supabase
            .from('certifications')
            .insert({
                student_id: data.student_id,
                name: data.name,
                category: data.category,
                issuing_organization: data.issuing_organization,
                issue_date: data.issue_date,
                expiry_date: data.expiry_date || null,
                credential_id: data.credential_id || null
            });

        if (error) throw error;

        showAlert('Certificate issued successfully!', 'success');
        closeModal();
        loadCertificates();

    } catch (error) {
        console.error('Error issuing certificate:', error);
        showAlert('Error issuing certificate: ' + error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-award"></i> Issue Certificate';
    }
}

// View and edit functions
async function viewStudent(id) {
    try {
        const { data: student, error } = await supabase
            .from('students')
            .select(`
                *,
                student_profiles(*),
                certifications(*)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        const profile = student.student_profiles?.[0] || {};
        const certs = student.certifications || [];

        const modalHTML = `
            <div class="modal-overlay" onclick="closeModal(event)">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>${student.first_name} ${student.last_name}</h2>
                        <button class="close-btn" onclick="closeModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                            <div><strong>Email:</strong><br>${student.email}</div>
                            <div><strong>Phone:</strong><br>${profile.phone || 'N/A'}</div>
                            <div><strong>Location:</strong><br>${profile.location || 'N/A'}</div>
                            <div><strong>Enrolled:</strong><br>${new Date(student.created_at).toLocaleDateString()}</div>
                        </div>
                        ${profile.bio ? `<div style="margin-bottom: 1.5rem;"><strong>Bio:</strong><p style="margin-top: 0.5rem;">${profile.bio}</p></div>` : ''}
                        ${certs.length > 0 ? `
                            <div><strong>Certifications (${certs.length}):</strong>
                                <ul style="margin-top: 0.5rem; list-style: none; padding: 0;">
                                    ${certs.map(cert => `<li style="padding: 0.5rem; background: #f8f9fa; margin-bottom: 0.5rem; border-radius: 0.25rem;"><strong>${cert.name}</strong> - ${cert.category}<br><small>Issued: ${new Date(cert.issue_date).toLocaleDateString()}</small></li>`).join('')}
                                </ul>
                            </div>
                        ` : '<p>No certifications yet.</p>'}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                        <button class="btn btn-primary" onclick="editStudent('${id}')"><i class="fas fa-edit"></i> Edit</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } catch (error) {
        console.error('Error viewing student:', error);
        showAlert('Error loading student details: ' + error.message, 'error');
    }
}

async function editStudent(id) {
    closeModal();
    try {
        const { data: student, error } = await supabase
            .from('students')
            .select(`*, student_profiles(*)`)
            .eq('id', id)
            .single();

        if (error) throw error;
        const profile = student.student_profiles?.[0] || {};

        const modalHTML = `
            <div class="modal-overlay" onclick="closeModal(event)">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Edit Student</h2>
                        <button class="close-btn" onclick="closeModal()"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body">
                        <form id="editStudentForm" onsubmit="updateStudent(event, '${id}')">
                            <div class="form-group"><label>First Name *</label><input type="text" name="first_name" value="${student.first_name}" required></div>
                            <div class="form-group"><label>Last Name *</label><input type="text" name="last_name" value="${student.last_name}" required></div>
                            <div class="form-group"><label>Email *</label><input type="email" name="email" value="${student.email}" required></div>
                            <div class="form-group"><label>Phone</label><input type="tel" name="phone" value="${profile.phone || ''}"></div>
                            <div class="form-group"><label>Location</label><input type="text" name="location" value="${profile.location || ''}"></div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                                <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } catch (error) {
        console.error('Error loading student:', error);
        showAlert('Error loading student: ' + error.message, 'error');
    }
}

async function updateStudent(event, id) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Saving...';

    try {
        await supabase.from('students').update({
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email
        }).eq('id', id);

        await supabase.from('student_profiles').upsert({
            student_id: id,
            phone: data.phone || null,
            location: data.location || null
        });

        showAlert('Student updated successfully!', 'success');
        closeModal();
        loadStudents();
    } catch (error) {
        console.error('Error updating student:', error);
        showAlert('Error updating student: ' + error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }
}

async function deleteStudent(id) {
    if (!confirm('Are you sure you want to delete this student? This action cannot be undone.')) return;
    
    try {
        const { error } = await supabase
            .from('students')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showAlert('Student deleted successfully', 'success');
        loadStudents();
    } catch (error) {
        console.error('Error deleting student:', error);
        showAlert('Error deleting student: ' + error.message, 'error');
    }
}

function viewClient(id) {
    alert('View client: ' + id);
}

function editClient(id) {
    alert('Edit client: ' + id);
}

async function deleteClient(id) {
    if (!confirm('Are you sure you want to delete this client?')) return;
    
    try {
        const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('Client deleted successfully');
        loadClients();
    } catch (error) {
        console.error('Error deleting client:', error);
        alert('Error deleting client: ' + error.message);
    }
}

function viewCertificate(id) {
    alert('View certificate: ' + id);
}

async function revokeCertificate(id) {
    if (!confirm('Are you sure you want to revoke this certificate?')) return;
    
    try {
        const { error } = await supabase
            .from('certifications')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('Certificate revoked successfully');
        loadCertificates();
    } catch (error) {
        console.error('Error revoking certificate:', error);
        alert('Error revoking certificate: ' + error.message);
    }
}

function showCreateRosterModal() {
    alert('Create roster modal - to be implemented');
}

function manageRoster(id) {
    alert('Manage roster: ' + id);
}

function showCreateCourseModal() {
    alert('Create course modal - to be implemented');
}

function editCourse(id) {
    alert('Edit course: ' + id);
}

// Export functions to window
window.logout = logout;
window.showCreateStudentModal = showCreateStudentModal;
window.showCreateClientModal = showCreateClientModal;
window.showIssueCertificateModal = showIssueCertificateModal;
window.showCreateRosterModal = showCreateRosterModal;
window.showCreateCourseModal = showCreateCourseModal;
window.closeModal = closeModal;
window.createStudent = createStudent;
window.createClient = createClient;
window.issueCertificate = issueCertificate;
window.viewStudent = viewStudent;
window.editStudent = editStudent;
window.updateStudent = updateStudent;
window.deleteStudent = deleteStudent;
window.viewClient = viewClient;
window.editClient = editClient;
window.deleteClient = deleteClient;
window.viewCertificate = viewCertificate;
window.revokeCertificate = revokeCertificate;
window.manageRoster = manageRoster;
window.editCourse = editCourse;
