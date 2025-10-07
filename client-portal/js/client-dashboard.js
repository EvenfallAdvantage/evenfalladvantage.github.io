// Client Dashboard Functionality

let currentClient = null;
let isEditMode = false;

// Initialize dashboard
(async function() {
    await checkAuth();
    await loadDashboardData();
    setupNavigation();
})();

// Check authentication
async function checkAuth() {
    const user = await ClientAuth.getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    // Verify user is a client
    const profileResult = await ClientData.getProfile(user.id);
    if (!profileResult.success) {
        alert('Client profile not found. Please contact support.');
        await ClientAuth.signOut();
        return;
    }
    
    currentClient = profileResult.data;
    window.currentClient = currentClient;
}

// Load dashboard data
async function loadDashboardData() {
    if (!currentClient) return;
    
    // Update company name
    document.getElementById('companyName').textContent = currentClient.company_name;
    
    // Load stats
    await loadStats();
    
    // Load company profile
    loadCompanyProfile();
    
    // Load job postings
    await loadJobPostings();
    
    // Load candidates
    await loadCandidates();
    
    // Load messages
    await loadMessages();
}

// Load statistics
async function loadStats() {
    const jobsResult = await ClientData.getJobPostings(currentClient.id);
    
    if (jobsResult.success && jobsResult.data) {
        const activeJobs = jobsResult.data.filter(j => j.status === 'active').length;
        document.getElementById('activeJobs').textContent = activeJobs;
    }
    
    // Placeholder stats
    document.getElementById('totalApplicants').textContent = '0';
    document.getElementById('hiredCandidates').textContent = '0';
    document.getElementById('unreadMessages').textContent = '0';
}

// Setup navigation
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    const sections = document.querySelectorAll('.section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.dataset.section;
            
            // Remove active class
            navLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            // Add active class
            link.classList.add('active');
            document.getElementById(sectionId).classList.add('active');
        });
    });
}

// Load company profile
function loadCompanyProfile() {
    document.getElementById('companyNameInput').value = currentClient.company_name || '';
    document.getElementById('industry').value = currentClient.industry || '';
    document.getElementById('contactName').value = currentClient.contact_name || '';
    document.getElementById('companyPhone').value = currentClient.phone || '';
    document.getElementById('companyEmail').value = currentClient.email || '';
    document.getElementById('address').value = currentClient.address || '';
    document.getElementById('city').value = currentClient.city || '';
    document.getElementById('state').value = currentClient.state || '';
    document.getElementById('zipCode').value = currentClient.zip_code || '';
    document.getElementById('companyDescription').value = currentClient.description || '';
    document.getElementById('website').value = currentClient.website || '';
}

// Toggle edit mode for company profile
function toggleEditCompany() {
    isEditMode = !isEditMode;
    
    const inputs = document.querySelectorAll('#companyForm input, #companyForm textarea');
    const editBtn = document.getElementById('editCompanyBtn');
    const formActions = document.querySelector('#companyForm .form-actions');
    
    if (isEditMode) {
        inputs.forEach(input => {
            if (input.id !== 'companyEmail') { // Email shouldn't be editable
                input.disabled = false;
            }
        });
        editBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
        formActions.style.display = 'flex';
    } else {
        inputs.forEach(input => input.disabled = true);
        editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
        formActions.style.display = 'none';
        loadCompanyProfile(); // Restore original values
    }
}

function cancelEditCompany() {
    toggleEditCompany();
}

// Handle company form submission
document.getElementById('companyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const profileData = {
        company_name: document.getElementById('companyNameInput').value,
        industry: document.getElementById('industry').value,
        contact_name: document.getElementById('contactName').value,
        phone: document.getElementById('companyPhone').value,
        address: document.getElementById('address').value,
        city: document.getElementById('city').value,
        state: document.getElementById('state').value,
        zip_code: document.getElementById('zipCode').value,
        description: document.getElementById('companyDescription').value,
        website: document.getElementById('website').value
    };
    
    const result = await ClientData.updateProfile(currentClient.id, profileData);
    
    if (result.success) {
        alert('Company profile updated successfully!');
        currentClient = { ...currentClient, ...profileData };
        document.getElementById('companyName').textContent = profileData.company_name;
        toggleEditCompany();
    } else {
        alert('Failed to update profile: ' + result.error);
    }
});

// Load job postings
async function loadJobPostings() {
    const result = await ClientData.getJobPostings(currentClient.id);
    
    if (!result.success || !result.data || result.data.length === 0) {
        document.getElementById('jobsList').innerHTML = '<p class="empty-state">No job postings yet. Create your first job posting!</p>';
        return;
    }
    
    const jobsHTML = result.data.map(job => `
        <div class="job-card">
            <div class="job-header">
                <div>
                    <h3 class="job-title">${job.title}</h3>
                    <div class="job-meta">
                        <span><i class="fas fa-map-marker-alt"></i> ${job.location}</span>
                        <span><i class="fas fa-clock"></i> ${job.employment_type}</span>
                        <span><i class="fas fa-dollar-sign"></i> ${job.salary_range || 'Not specified'}</span>
                    </div>
                </div>
                <span class="job-status ${job.status}">${job.status}</span>
            </div>
            <p>${job.description.substring(0, 150)}...</p>
            <div class="job-actions" style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                <button class="btn btn-small btn-secondary" onclick="editJob('${job.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-small btn-secondary" onclick="toggleJobStatus('${job.id}', '${job.status}')">
                    <i class="fas fa-toggle-on"></i> ${job.status === 'active' ? 'Close' : 'Activate'}
                </button>
                <button class="btn btn-small btn-secondary" onclick="deleteJob('${job.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
    
    document.getElementById('jobsList').innerHTML = jobsHTML;
}

// Show create job modal
function showCreateJobModal() {
    document.getElementById('createJobModal').classList.add('active');
}

function closeCreateJobModal() {
    document.getElementById('createJobModal').classList.remove('active');
    document.getElementById('createJobForm').reset();
}

// Handle create job form
document.getElementById('createJobForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const requiredCerts = Array.from(document.querySelectorAll('#createJobForm input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    
    const jobData = {
        title: document.getElementById('jobTitle').value,
        location: document.getElementById('jobLocation').value,
        employment_type: document.getElementById('employmentType').value,
        salary_range: document.getElementById('salaryRange').value,
        description: document.getElementById('jobDescription').value,
        required_certifications: requiredCerts,
        status: 'active'
    };
    
    const result = await ClientData.createJobPosting(currentClient.id, jobData);
    
    if (result.success) {
        alert('Job posted successfully!');
        closeCreateJobModal();
        await loadJobPostings();
        await loadStats();
    } else {
        alert('Failed to post job: ' + result.error);
    }
});

// Toggle job status
async function toggleJobStatus(jobId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'closed' : 'active';
    const result = await ClientData.updateJobPosting(jobId, { status: newStatus });
    
    if (result.success) {
        await loadJobPostings();
        await loadStats();
    } else {
        alert('Failed to update job status');
    }
}

// Delete job
async function deleteJob(jobId) {
    if (!confirm('Are you sure you want to delete this job posting?')) return;
    
    const result = await ClientData.deleteJobPosting(jobId);
    
    if (result.success) {
        await loadJobPostings();
        await loadStats();
    } else {
        alert('Failed to delete job');
    }
}

// Load candidates
async function loadCandidates() {
    console.log('Loading candidates...');
    const result = await ClientData.searchCandidates();
    console.log('Search result:', result);
    
    if (!result.success) {
        console.error('Search failed:', result.error);
        document.getElementById('candidatesGrid').innerHTML = `<p class="empty-state">Error loading candidates: ${result.error || 'Unknown error'}</p>`;
        return;
    }
    
    if (!result.data || result.data.length === 0) {
        console.log('No candidates found');
        document.getElementById('candidatesGrid').innerHTML = '<p class="empty-state">No candidates available yet</p>';
        return;
    }
    
    console.log(`Found ${result.data.length} candidates`);
    
    const candidatesHTML = result.data.map(student => {
        const profile = student.student_profiles || {};
        const completedModules = student.student_module_progress?.filter(p => p.status === 'completed').length || 0;
        
        return `
            <div class="candidate-card">
                <div class="candidate-header">
                    <div class="candidate-avatar">
                        ${profile.profile_picture_url ? 
                            `<img src="${profile.profile_picture_url}" alt="${student.first_name}">` : 
                            `<i class="fas fa-user"></i>`
                        }
                    </div>
                    <div class="candidate-info">
                        <h4>${student.first_name} ${student.last_name}</h4>
                        <p class="candidate-location">
                            <i class="fas fa-map-marker-alt"></i> ${profile.location || 'Location not specified'}
                        </p>
                    </div>
                </div>
                
                ${profile.bio ? `<p style="margin: 1rem 0; color: var(--text-secondary);">${profile.bio.substring(0, 100)}...</p>` : ''}
                
                <div class="candidate-skills">
                    ${profile.skills && profile.skills.length > 0 ? 
                        profile.skills.slice(0, 3).map(skill => `<span class="skill-badge">${skill}</span>`).join('') :
                        '<span class="skill-badge">No skills listed</span>'
                    }
                </div>
                
                <div style="margin: 1rem 0; padding: 0.75rem; background: #f8f9fa; border-radius: 0.5rem;">
                    <strong>${completedModules}/7</strong> modules completed
                </div>
                
                <div class="candidate-actions">
                    <button class="btn btn-small btn-primary" onclick="viewCandidate('${student.id}')">
                        <i class="fas fa-eye"></i> View Profile
                    </button>
                    <button class="btn btn-small btn-secondary" onclick="contactCandidate('${student.id}')">
                        <i class="fas fa-envelope"></i> Contact
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('candidatesGrid').innerHTML = candidatesHTML;
}

// Apply filters
async function applyFilters() {
    const searchTerm = document.getElementById('candidateSearch').value;
    const location = document.getElementById('locationFilter').value;
    const certification = document.getElementById('certificationFilter').value;
    
    const filters = {};
    if (location) filters.location = location;
    if (certification) filters.certification = certification;
    
    const result = await ClientData.searchCandidates(filters);
    
    if (result.success && result.data) {
        // Filter by search term locally
        let filteredData = result.data;
        if (searchTerm) {
            filteredData = filteredData.filter(student => {
                const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
                const skills = student.student_profiles?.skills?.join(' ').toLowerCase() || '';
                const location = student.student_profiles?.location?.toLowerCase() || '';
                const term = searchTerm.toLowerCase();
                
                return fullName.includes(term) || skills.includes(term) || location.includes(term);
            });
        }
        
        // Re-render candidates
        displayFilteredCandidates(filteredData);
    }
}

function displayFilteredCandidates(candidates) {
    if (candidates.length === 0) {
        document.getElementById('candidatesGrid').innerHTML = '<p class="empty-state">No candidates match your filters</p>';
        return;
    }
    
    // Use same rendering logic as loadCandidates
    const candidatesHTML = candidates.map(student => {
        const profile = student.student_profiles || {};
        const completedModules = student.student_module_progress?.filter(p => p.status === 'completed').length || 0;
        
        return `
            <div class="candidate-card">
                <div class="candidate-header">
                    <div class="candidate-avatar">
                        ${profile.profile_picture_url ? 
                            `<img src="${profile.profile_picture_url}" alt="${student.first_name}">` : 
                            `<i class="fas fa-user"></i>`
                        }
                    </div>
                    <div class="candidate-info">
                        <h4>${student.first_name} ${student.last_name}</h4>
                        <p class="candidate-location">
                            <i class="fas fa-map-marker-alt"></i> ${profile.location || 'Location not specified'}
                        </p>
                    </div>
                </div>
                
                ${profile.bio ? `<p style="margin: 1rem 0; color: var(--text-secondary);">${profile.bio.substring(0, 100)}...</p>` : ''}
                
                <div class="candidate-skills">
                    ${profile.skills && profile.skills.length > 0 ? 
                        profile.skills.slice(0, 3).map(skill => `<span class="skill-badge">${skill}</span>`).join('') :
                        '<span class="skill-badge">No skills listed</span>'
                    }
                </div>
                
                <div style="margin: 1rem 0; padding: 0.75rem; background: #f8f9fa; border-radius: 0.5rem;">
                    <strong>${completedModules}/7</strong> modules completed
                </div>
                
                <div class="candidate-actions">
                    <button class="btn btn-small btn-primary" onclick="viewCandidate('${student.id}')">
                        <i class="fas fa-eye"></i> View Profile
                    </button>
                    <button class="btn btn-small btn-secondary" onclick="contactCandidate('${student.id}')">
                        <i class="fas fa-envelope"></i> Contact
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('candidatesGrid').innerHTML = candidatesHTML;
}

// View candidate details
async function viewCandidate(studentId) {
    // Get student data
    const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id, first_name, last_name, email')
        .eq('id', studentId)
        .single();
    
    if (studentError) {
        alert('Error loading candidate profile');
        return;
    }
    
    // Get profile data
    const { data: profile, error: profileError } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('student_id', studentId)
        .single();
    
    if (profileError) {
        alert('Error loading candidate profile');
        return;
    }
    
    // Get module progress
    const { data: progress } = await supabase
        .from('student_module_progress')
        .select('*')
        .eq('student_id', studentId);
    
    const completedModules = progress?.filter(p => p.status === 'completed').length || 0;
    
    // Get work experience
    const { data: experience } = await supabase
        .from('work_experience')
        .select('*')
        .eq('student_id', studentId)
        .order('start_date', { ascending: false });
    
    // Create modal HTML
    const modalHTML = `
        <div class="modal-overlay" id="candidateModal" onclick="closeCandidateModal()">
            <div class="modal-content candidate-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h2>Candidate Profile</h2>
                    <button class="close-btn" onclick="closeCandidateModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="candidate-profile-header">
                        <div class="candidate-avatar-large">
                            ${profile.profile_picture_url ? 
                                `<img src="${profile.profile_picture_url}" alt="${student.first_name}">` : 
                                `<i class="fas fa-user"></i>`
                            }
                        </div>
                        <div class="candidate-profile-info">
                            <h3>${student.first_name} ${student.last_name}</h3>
                            <p><i class="fas fa-map-marker-alt"></i> ${profile.location || 'Location not specified'}</p>
                            <p><i class="fas fa-envelope"></i> ${student.email}</p>
                            ${profile.phone ? `<p><i class="fas fa-phone"></i> ${profile.phone}</p>` : ''}
                            ${profile.linkedin_url ? `<p><i class="fab fa-linkedin"></i> <a href="${profile.linkedin_url}" target="_blank">LinkedIn Profile</a></p>` : ''}
                        </div>
                    </div>
                    
                    ${profile.bio ? `
                        <div class="profile-section">
                            <h4>About</h4>
                            <p>${profile.bio}</p>
                        </div>
                    ` : ''}
                    
                    ${profile.skills && profile.skills.length > 0 ? `
                        <div class="profile-section">
                            <h4>Skills</h4>
                            <div class="skills-list">
                                ${profile.skills.map(skill => `<span class="skill-badge">${skill}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${experience && experience.length > 0 ? `
                        <div class="profile-section">
                            <h4>Work Experience</h4>
                            ${experience.map(exp => `
                                <div class="experience-item">
                                    <h5>${exp.job_title}</h5>
                                    <p class="company-name">${exp.company_name}</p>
                                    <p class="date-range">
                                        <i class="fas fa-calendar"></i>
                                        ${new Date(exp.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - 
                                        ${exp.end_date ? new Date(exp.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Present'}
                                    </p>
                                    ${exp.description ? `<p class="experience-description">${exp.description}</p>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <div class="profile-section">
                        <h4>Training Progress</h4>
                        <p><strong>${completedModules}/7</strong> modules completed</p>
                    </div>
                    
                    ${profile.certifications_completed && profile.certifications_completed.length > 0 ? `
                        <div class="profile-section">
                            <h4>Certifications</h4>
                            <ul>
                                ${profile.certifications_completed.map(cert => `<li>${cert}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeCandidateModal()">Close</button>
                    <button class="btn btn-primary" onclick="contactCandidate('${studentId}')">
                        <i class="fas fa-envelope"></i> Contact Candidate
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeCandidateModal() {
    const modal = document.getElementById('candidateModal');
    if (modal) modal.remove();
}

// Store current conversation
let currentConversationUserId = null;
let currentConversationUserName = null;

// Contact candidate (now opens conversation directly)
async function contactCandidate(studentId) {
    // Close candidate modal if open
    closeCandidateModal();
    
    // Get student info
    const { data: student } = await supabase
        .from('students')
        .select('first_name, last_name, email')
        .eq('id', studentId)
        .single();
    
    if (!student) {
        alert('Error loading candidate information');
        return;
    }
    
    const studentName = `${student.first_name} ${student.last_name}`;
    
    // Switch to messages tab and open conversation
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    
    document.querySelector('[data-section="messages"]').classList.add('active');
    document.getElementById('messages').classList.add('active');
    
    // Open the conversation
    await viewConversation(studentId, studentName);
}

// Send message from inline input
async function sendMessageInline() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message || !currentConversationUserId) return;
    
    const currentUser = await ClientAuth.getCurrentUser();
    if (!currentUser) {
        alert('You must be logged in to send messages');
        return;
    }
    
    // Disable input while sending
    messageInput.disabled = true;
    
    // Create or get thread
    const { data: existingThread } = await supabase
        .from('message_threads')
        .select('id')
        .or(`and(participant_1.eq.${currentUser.id},participant_2.eq.${currentConversationUserId}),and(participant_1.eq.${currentConversationUserId},participant_2.eq.${currentUser.id})`)
        .maybeSingle();
    
    if (!existingThread) {
        // Create new thread
        await supabase
            .from('message_threads')
            .insert({
                participant_1: currentUser.id,
                participant_2: currentConversationUserId
            });
    }
    
    // Send message
    const { error } = await supabase
        .from('messages')
        .insert({
            from_user_id: currentUser.id,
            to_user_id: currentConversationUserId,
            subject: 'Direct Message',
            message: message
        });
    
    if (error) {
        alert('Error sending message: ' + error.message);
        messageInput.disabled = false;
        return;
    }
    
    // Clear input
    messageInput.value = '';
    messageInput.disabled = false;
    messageInput.focus();
    
    // Reload conversation to show new message
    await viewConversation(currentConversationUserId, currentConversationUserName);
    
    // Refresh conversations list
    await loadMessages();
}

// Load messages and conversations
async function loadMessages() {
    const currentUser = await ClientAuth.getCurrentUser();
    if (!currentUser) return;
    
    // Get all message threads for current user
    const { data: threads, error } = await supabase
        .from('message_threads')
        .select('*')
        .or(`participant_1.eq.${currentUser.id},participant_2.eq.${currentUser.id}`)
        .order('last_message_at', { ascending: false });
    
    if (error) {
        console.error('Error loading threads:', error);
        return;
    }
    
    if (!threads || threads.length === 0) {
        document.getElementById('conversationsList').innerHTML = '<p class="empty-state">No messages yet</p>';
        return;
    }
    
    // Get user info for all participants
    const participantIds = new Set();
    threads.forEach(thread => {
        participantIds.add(thread.participant_1);
        participantIds.add(thread.participant_2);
    });
    participantIds.delete(currentUser.id); // Remove current user
    
    // Get student info for participants
    const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name, email')
        .in('id', Array.from(participantIds));
    
    // Get student profiles for avatars
    const { data: profiles } = await supabase
        .from('student_profiles')
        .select('student_id, profile_picture_url')
        .in('student_id', Array.from(participantIds));
    
    // Get last message for each thread
    const threadMessages = await Promise.all(threads.map(async (thread) => {
        const { data: lastMessage } = await supabase
            .from('messages')
            .select('*')
            .or(`and(from_user_id.eq.${thread.participant_1},to_user_id.eq.${thread.participant_2}),and(from_user_id.eq.${thread.participant_2},to_user_id.eq.${thread.participant_1})`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        // Get unread count
        const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('to_user_id', currentUser.id)
            .eq('read', false)
            .or(`from_user_id.eq.${thread.participant_1},from_user_id.eq.${thread.participant_2}`);
        
        return { thread, lastMessage, unreadCount };
    }));
    
    // Build conversations HTML
    const conversationsHTML = threadMessages.map(({ thread, lastMessage, unreadCount }) => {
        const otherUserId = thread.participant_1 === currentUser.id ? thread.participant_2 : thread.participant_1;
        const student = students?.find(s => s.id === otherUserId);
        const profile = profiles?.find(p => p.student_id === otherUserId);
        
        if (!student) return '';
        
        const preview = lastMessage ? lastMessage.message.substring(0, 60) + '...' : 'No messages yet';
        const timeAgo = lastMessage ? getTimeAgo(new Date(lastMessage.created_at)) : '';
        
        return `
            <div class="conversation-item ${unreadCount > 0 ? 'unread' : ''}" onclick="viewConversation('${otherUserId}', '${student.first_name} ${student.last_name}')">
                <div class="conversation-avatar">
                    ${profile?.profile_picture_url ? 
                        `<img src="${profile.profile_picture_url}" alt="${student.first_name}">` : 
                        `<i class="fas fa-user"></i>`
                    }
                </div>
                <div class="conversation-info">
                    <div class="conversation-header">
                        <h4>${student.first_name} ${student.last_name}</h4>
                        ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
                    </div>
                    <p class="conversation-preview">${preview}</p>
                    <span class="conversation-time">${timeAgo}</span>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('conversationsList').innerHTML = conversationsHTML || '<p class="empty-state">No messages yet</p>';
    
    // Update unread messages count in stats
    const totalUnread = threadMessages.reduce((sum, { unreadCount }) => sum + (unreadCount || 0), 0);
    document.getElementById('unreadMessages').textContent = totalUnread;
}

// View conversation with a specific user
async function viewConversation(userId, userName) {
    const currentUser = await ClientAuth.getCurrentUser();
    if (!currentUser) return;
    
    // Get all messages in this conversation
    const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(from_user_id.eq.${currentUser.id},to_user_id.eq.${userId}),and(from_user_id.eq.${userId},to_user_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });
    
    if (error) {
        console.error('Error loading messages:', error);
        return;
    }
    
    // Mark messages as read
    await supabase
        .from('messages')
        .update({ read: true })
        .eq('to_user_id', currentUser.id)
        .eq('from_user_id', userId);
    
    // Store current conversation
    currentConversationUserId = userId;
    currentConversationUserName = userName;
    
    // Build messages HTML
    const messagesHTML = messages.map(msg => {
        const isFromMe = msg.from_user_id === currentUser.id;
        const time = new Date(msg.created_at);
        const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        return `
            <div class="message-bubble ${isFromMe ? 'sent' : 'received'}">
                <div class="bubble-content">
                    ${msg.message}
                </div>
                <div class="bubble-time">${timeStr}</div>
            </div>
        `;
    }).join('');
    
    // Update message view
    const messageView = document.querySelector('.message-view');
    messageView.innerHTML = `
        <div class="conversation-header">
            <div class="conversation-header-info">
                <div class="conversation-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <h3>${userName}</h3>
            </div>
            <button class="close-conversation-btn" onclick="closeConversation()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="messages-list" id="messagesList">
            ${messagesHTML || '<p class="empty-state">No messages yet. Start the conversation!</p>'}
        </div>
        <div class="message-input-container">
            <input type="text" id="messageInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter') sendMessageInline()">
            <button class="btn btn-primary send-btn" onclick="sendMessageInline()">
                <i class="fas fa-paper-plane"></i>
            </button>
        </div>
    `;
    
    // Scroll to bottom
    setTimeout(() => {
        const messagesList = document.getElementById('messagesList');
        if (messagesList) {
            messagesList.scrollTop = messagesList.scrollHeight;
        }
    }, 100);
    
    // Refresh conversations list to update unread counts
    await loadMessages();
}

// Close conversation and return to placeholder
function closeConversation() {
    currentConversationUserId = null;
    currentConversationUserName = null;
    
    const messageView = document.querySelector('.message-view');
    messageView.innerHTML = `
        <div class="message-placeholder">
            <i class="fas fa-comments"></i>
            <p>Select a conversation to view messages</p>
        </div>
    `;
}

// Helper function to get time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    return date.toLocaleDateString();
}

// Edit job
function editJob(jobId) {
    alert('Edit job feature coming soon! Job ID: ' + jobId);
    // TODO: Show edit job modal
}

// Export functions
window.showCreateJobModal = showCreateJobModal;
window.closeCreateJobModal = closeCreateJobModal;
window.toggleEditCompany = toggleEditCompany;
window.cancelEditCompany = cancelEditCompany;
window.applyFilters = applyFilters;
window.viewCandidate = viewCandidate;
window.closeCandidateModal = closeCandidateModal;
window.contactCandidate = contactCandidate;
window.sendMessageInline = sendMessageInline;
window.loadMessages = loadMessages;
window.viewConversation = viewConversation;
window.closeConversation = closeConversation;
window.toggleJobStatus = toggleJobStatus;
window.deleteJob = deleteJob;
window.editJob = editJob;
