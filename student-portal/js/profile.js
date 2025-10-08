// Profile Management System

let isEditMode = false;
let originalProfileData = {};

// Initialize profile on page load
(async function() {
    await loadProfileData();
    setupProfileTabs();
    setupProfileVisibility();
})();

// Load profile data from Supabase
async function loadProfileData() {
    const user = await Auth.getCurrentUser();
    if (!user) return;
    
    // Load basic user info
    document.getElementById('profileName').textContent = `${user.user_metadata.first_name || ''} ${user.user_metadata.last_name || ''}`.trim() || 'User';
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('profileJoined').textContent = `Member since: ${new Date(user.created_at).toLocaleDateString()}`;
    
    // Load profile from database
    const profileResult = await StudentData.getProfile(user.id);
    if (profileResult.success && profileResult.data) {
        const profile = profileResult.data;
        
        // Populate form fields
        document.getElementById('firstName').value = user.user_metadata.first_name || '';
        document.getElementById('lastName').value = user.user_metadata.last_name || '';
        document.getElementById('phone').value = profile.phone || '';
        document.getElementById('location').value = profile.location || '';
        document.getElementById('bio').value = profile.bio || '';
        document.getElementById('linkedin').value = profile.linkedin_url || '';
        
        // Load skills
        if (profile.skills && profile.skills.length > 0) {
            displaySkills(profile.skills);
        }
        
        // Load certifications
        const certificationsResult = await loadCertifications(user.id);
        if (certificationsResult) {
            displayCertifications(certificationsResult);
        }
        
        // Load work experience
        const experienceResult = await loadWorkExperience(user.id);
        if (experienceResult) {
            displayExperience(experienceResult);
        }
        
        // Load profile visibility
        document.getElementById('profileVisibility').checked = profile.profile_visible || false;
        updateVisibilityStatus(profile.profile_visible || false);
        
        // Load profile picture
        if (profile.profile_picture_url) {
            document.getElementById('profileAvatar').innerHTML = `<img src="${profile.profile_picture_url}" alt="Profile">`;
        }
    }
}

// Setup profile tabs
function setupProfileTabs() {
    const tabs = document.querySelectorAll('.profile-tab');
    const tabContents = document.querySelectorAll('.profile-tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });
}

// Toggle edit mode
function toggleEditMode() {
    isEditMode = !isEditMode;
    
    const inputs = document.querySelectorAll('#profileForm input, #profileForm textarea');
    const editBtn = document.getElementById('editProfileBtn');
    const formActions = document.querySelector('.form-actions');
    
    if (isEditMode) {
        // Save original data
        originalProfileData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            phone: document.getElementById('phone').value,
            location: document.getElementById('location').value,
            bio: document.getElementById('bio').value,
            linkedin: document.getElementById('linkedin').value
        };
        
        // Enable inputs
        inputs.forEach(input => input.disabled = false);
        editBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
        formActions.style.display = 'flex';
    } else {
        // Disable inputs
        inputs.forEach(input => input.disabled = true);
        editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
        formActions.style.display = 'none';
    }
}

// Cancel edit
function cancelEdit() {
    // Restore original data
    document.getElementById('firstName').value = originalProfileData.firstName;
    document.getElementById('lastName').value = originalProfileData.lastName;
    document.getElementById('phone').value = originalProfileData.phone;
    document.getElementById('location').value = originalProfileData.location;
    document.getElementById('bio').value = originalProfileData.bio;
    document.getElementById('linkedin').value = originalProfileData.linkedin;
    
    toggleEditMode();
}

// Handle profile form submission
document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const user = await Auth.getCurrentUser();
    if (!user) return;
    
    const profileData = {
        phone: document.getElementById('phone').value,
        location: document.getElementById('location').value,
        bio: document.getElementById('bio').value,
        linkedin_url: document.getElementById('linkedin').value
    };
    
    const result = await StudentData.updateProfile(user.id, profileData);
    
    if (result.success) {
        alert('Profile updated successfully!');
        toggleEditMode();
    } else {
        alert('Failed to update profile: ' + result.error);
    }
});

// Skills management
function displaySkills(skills) {
    const container = document.getElementById('skillsContainer');
    container.innerHTML = skills.map(skill => `
        <div class="skill-tag">
            ${skill}
            <button onclick="removeSkill('${skill}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

async function addSkill() {
    const skill = prompt('Enter a skill:');
    if (!skill) return;
    
    const user = await Auth.getCurrentUser();
    if (!user) return;
    
    const profileResult = await StudentData.getProfile(user.id);
    if (!profileResult.success) return;
    
    const currentSkills = profileResult.data.skills || [];
    const updatedSkills = [...currentSkills, skill];
    
    const result = await StudentData.updateProfile(user.id, { skills: updatedSkills });
    
    if (result.success) {
        displaySkills(updatedSkills);
    }
}

async function removeSkill(skillToRemove) {
    const user = await Auth.getCurrentUser();
    if (!user) return;
    
    const profileResult = await StudentData.getProfile(user.id);
    if (!profileResult.success) return;
    
    const currentSkills = profileResult.data.skills || [];
    const updatedSkills = currentSkills.filter(skill => skill !== skillToRemove);
    
    const result = await StudentData.updateProfile(user.id, { skills: updatedSkills });
    
    if (result.success) {
        displaySkills(updatedSkills);
    }
}

// Work experience management
async function loadWorkExperience(studentId) {
    const { data, error } = await supabase
        .from('work_experience')
        .select('*')
        .eq('student_id', studentId)
        .order('start_date', { ascending: false });
    
    if (error) {
        console.error('Error loading work experience:', error);
        return null;
    }
    
    return data;
}

function displayExperience(experiences) {
    const container = document.getElementById('experienceContainer');
    
    if (!experiences || experiences.length === 0) {
        container.innerHTML = '<p class="text-muted">No work experience added yet</p>';
        return;
    }
    
    container.innerHTML = experiences.map(exp => `
        <div class="experience-item">
            <div class="experience-header">
                <div>
                    <h4>${exp.job_title}</h4>
                    <p class="experience-company">${exp.company_name}</p>
                    <p class="experience-dates">
                        ${new Date(exp.start_date).toLocaleDateString()} - 
                        ${exp.end_date ? new Date(exp.end_date).toLocaleDateString() : 'Present'}
                    </p>
                </div>
                <button onclick="removeExperience('${exp.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            ${exp.description ? `<p class="experience-description">${exp.description}</p>` : ''}
        </div>
    `).join('');
}

function addExperience() {
    // Show modal form
    const modalHTML = `
        <div class="modal-overlay" id="experienceModal" onclick="closeExperienceModal()">
            <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>Add Work Experience</h2>
                    <button class="close-btn" onclick="closeExperienceModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="experienceForm" onsubmit="submitExperience(event)">
                        <div class="form-group">
                            <label for="jobTitle">Job Title *</label>
                            <input type="text" id="jobTitle" required placeholder="e.g., Security Officer">
                        </div>
                        <div class="form-group">
                            <label for="companyName">Company Name *</label>
                            <input type="text" id="companyName" required placeholder="e.g., ABC Security Services">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="startDate">Start Date *</label>
                                <input type="date" id="startDate" required>
                            </div>
                            <div class="form-group">
                                <label for="endDate">End Date</label>
                                <input type="date" id="endDate">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="currentJob" onchange="toggleEndDate()">
                                I currently work here
                            </label>
                        </div>
                        <div class="form-group">
                            <label for="expDescription">Description</label>
                            <textarea id="expDescription" rows="4" placeholder="Describe your responsibilities and achievements..."></textarea>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeExperienceModal()">Cancel</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-plus"></i> Add Experience
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeExperienceModal() {
    const modal = document.getElementById('experienceModal');
    if (modal) modal.remove();
}

function toggleEndDate() {
    const endDateInput = document.getElementById('endDate');
    const currentJobCheckbox = document.getElementById('currentJob');
    
    if (currentJobCheckbox.checked) {
        endDateInput.value = '';
        endDateInput.disabled = true;
    } else {
        endDateInput.disabled = false;
    }
}

async function submitExperience(event) {
    event.preventDefault();
    
    const user = await Auth.getCurrentUser();
    if (!user) return;
    
    const jobTitle = document.getElementById('jobTitle').value;
    const companyName = document.getElementById('companyName').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const description = document.getElementById('expDescription').value;
    
    const { data, error } = await supabase
        .from('work_experience')
        .insert({
            student_id: user.id,
            job_title: jobTitle,
            company_name: companyName,
            start_date: startDate,
            end_date: endDate || null,
            description: description || null
        });
    
    if (error) {
        alert('Failed to add experience: ' + error.message);
    } else {
        closeExperienceModal();
        const experiences = await loadWorkExperience(user.id);
        displayExperience(experiences);
    }
}

async function removeExperience(expId) {
    if (!confirm('Remove this experience?')) return;
    
    const { error } = await supabase
        .from('work_experience')
        .delete()
        .eq('id', expId);
    
    if (error) {
        alert('Failed to remove experience: ' + error.message);
    } else {
        const user = await Auth.getCurrentUser();
        const experiences = await loadWorkExperience(user.id);
        displayExperience(experiences);
    }
}

// Certifications management
async function loadCertifications(studentId) {
    const { data, error } = await supabase
        .from('certifications')
        .select('*')
        .eq('student_id', studentId)
        .order('issue_date', { ascending: false});
    
    if (error) {
        console.error('Error loading certifications:', error);
        return null;
    }
    
    return data;
}

function displayCertifications(certifications) {
    const container = document.getElementById('certificationsContainer');
    
    if (!certifications || certifications.length === 0) {
        container.innerHTML = '<p class="text-muted">No certifications added yet</p>';
        return;
    }
    
    // Group by category
    const grouped = {
        'Fire': [],
        'Medical': [],
        'LEO': [],
        'Military': [],
        'Security': []
    };
    
    certifications.forEach(cert => {
        if (grouped[cert.category]) {
            grouped[cert.category].push(cert);
        }
    });
    
    let html = '';
    Object.keys(grouped).forEach(category => {
        if (grouped[category].length > 0) {
            html += `
                <div class="cert-category">
                    <h4 class="cert-category-title">
                        <i class="fas fa-${getCategoryIcon(category)}"></i> ${category}
                    </h4>
                    <div class="cert-items">
                        ${grouped[category].map(cert => `
                            <div class="cert-item">
                                <div class="cert-info">
                                    <h5>${cert.name}</h5>
                                    <p class="cert-issuer">${cert.issuing_organization}</p>
                                    <p class="cert-date">
                                        Issued: ${new Date(cert.issue_date).toLocaleDateString()}
                                        ${cert.expiry_date ? ` | Expires: ${new Date(cert.expiry_date).toLocaleDateString()}` : ''}
                                    </p>
                                    ${cert.credential_id ? `<p class="cert-credential">ID: ${cert.credential_id}</p>` : ''}
                                    ${cert.file_url ? `<a href="${cert.file_url}" target="_blank" class="cert-link"><i class="fas fa-file-pdf"></i> View Certificate</a>` : ''}
                                </div>
                                <button class="btn-icon-danger" onclick="removeCertification('${cert.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    });
    
    container.innerHTML = html || '<p class="text-muted">No certifications added yet</p>';
}

function getCategoryIcon(category) {
    const icons = {
        'Fire': 'fire',
        'Medical': 'heartbeat',
        'LEO': 'shield-alt',
        'Military': 'star',
        'Security': 'lock'
    };
    return icons[category] || 'certificate';
}

function addCertification() {
    const modalHTML = `
        <div class="modal-overlay" id="certModal" onclick="closeCertModal()">
            <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>Add Certification</h2>
                    <button class="close-btn" onclick="closeCertModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="certForm" onsubmit="submitCertification(event)">
                        <div class="form-group">
                            <label for="certName">Certification Name *</label>
                            <input type="text" id="certName" required placeholder="e.g., CPR/AED Certification">
                        </div>
                        <div class="form-group">
                            <label for="certCategory">Category *</label>
                            <select id="certCategory" required>
                                <option value="">Select a category...</option>
                                <option value="Fire">Fire</option>
                                <option value="Medical">Medical</option>
                                <option value="LEO">Law Enforcement</option>
                                <option value="Military">Military</option>
                                <option value="Security">Security</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="certIssuer">Issuing Organization *</label>
                            <input type="text" id="certIssuer" required placeholder="e.g., American Red Cross">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="certIssueDate">Issue Date *</label>
                                <input type="date" id="certIssueDate" required>
                            </div>
                            <div class="form-group">
                                <label for="certExpiryDate">Expiry Date</label>
                                <input type="date" id="certExpiryDate">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="certCredentialId">Credential ID</label>
                            <input type="text" id="certCredentialId" placeholder="Optional">
                        </div>
                        <div class="form-group">
                            <label for="certFile">Upload Certificate (PDF, JPG, PNG)</label>
                            <input type="file" id="certFile" accept=".pdf,.jpg,.jpeg,.png">
                            <small style="color: var(--text-secondary, #6c757d); display: block; margin-top: 0.5rem;">
                                Max file size: 5MB
                            </small>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeCertModal()">Cancel</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-plus"></i> Add Certification
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeCertModal() {
    const modal = document.getElementById('certModal');
    if (modal) modal.remove();
}

async function submitCertification(event) {
    event.preventDefault();
    
    const user = await Auth.getCurrentUser();
    if (!user) return;
    
    const certName = document.getElementById('certName').value;
    const category = document.getElementById('certCategory').value;
    const issuer = document.getElementById('certIssuer').value;
    const issueDate = document.getElementById('certIssueDate').value;
    const expiryDate = document.getElementById('certExpiryDate').value;
    const credentialId = document.getElementById('certCredentialId').value;
    const fileInput = document.getElementById('certFile');
    
    let fileUrl = null;
    
    // Upload file if provided
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('certifications')
            .upload(fileName, file);
        
        if (uploadError) {
            alert('Failed to upload file: ' + uploadError.message);
            return;
        }
        
        const { data: urlData } = supabase.storage
            .from('certifications')
            .getPublicUrl(fileName);
        
        fileUrl = urlData.publicUrl;
    }
    
    const { data, error } = await supabase
        .from('certifications')
        .insert({
            student_id: user.id,
            name: certName,
            category: category,
            issuing_organization: issuer,
            issue_date: issueDate,
            expiry_date: expiryDate || null,
            credential_id: credentialId || null,
            file_url: fileUrl
        });
    
    if (error) {
        alert('Failed to add certification: ' + error.message);
    } else {
        closeCertModal();
        const certifications = await loadCertifications(user.id);
        displayCertifications(certifications);
    }
}

async function removeCertification(certId) {
    if (!confirm('Remove this certification?')) return;
    
    const { error } = await supabase
        .from('certifications')
        .delete()
        .eq('id', certId);
    
    if (error) {
        alert('Failed to remove certification: ' + error.message);
    } else {
        const user = await Auth.getCurrentUser();
        const certifications = await loadCertifications(user.id);
        displayCertifications(certifications);
    }
}

// Profile visibility
function setupProfileVisibility() {
    const toggle = document.getElementById('profileVisibility');
    toggle.addEventListener('change', async (e) => {
        const isVisible = e.target.checked;
        
        const user = await Auth.getCurrentUser();
        if (!user) return;
        
        const result = await StudentData.updateProfile(user.id, {
            profile_visible: isVisible
        });
        
        if (result.success) {
            updateVisibilityStatus(isVisible);
        } else {
            e.target.checked = !isVisible;
            alert('Failed to update visibility');
        }
    });
}

function updateVisibilityStatus(isVisible) {
    const statusElement = document.getElementById('visibilityStatus');
    statusElement.textContent = isVisible ? 'public' : 'private';
    statusElement.style.color = isVisible ? 'var(--success-color)' : 'var(--danger-color)';
}

// Profile picture upload
function uploadProfilePicture() {
    document.getElementById('profilePictureInput').click();
}

document.getElementById('profilePictureInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const user = await Auth.getCurrentUser();
    if (!user) return;
    
    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}.${fileExt}`;
    const filePath = `avatars/${fileName}`;
    
    const { data, error } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, { upsert: true });
    
    if (error) {
        alert('Failed to upload picture: ' + error.message);
        return;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);
    
    // Update profile with picture URL
    await StudentData.updateProfile(user.id, {
        profile_picture_url: urlData.publicUrl
    });
    
    // Display the picture
    document.getElementById('profileAvatar').innerHTML = `<img src="${urlData.publicUrl}" alt="Profile">`;
});

// Export functions
window.toggleEditMode = toggleEditMode;
window.cancelEdit = cancelEdit;
window.addSkill = addSkill;
window.removeSkill = removeSkill;
window.addExperience = addExperience;
window.removeExperience = removeExperience;
window.closeExperienceModal = closeExperienceModal;
window.toggleEndDate = toggleEndDate;
window.submitExperience = submitExperience;
window.addCertification = addCertification;
window.removeCertification = removeCertification;
window.closeCertModal = closeCertModal;
window.submitCertification = submitCertification;
window.uploadProfilePicture = uploadProfilePicture;
