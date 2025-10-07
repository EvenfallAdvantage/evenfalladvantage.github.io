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

async function addExperience() {
    const jobTitle = prompt('Job Title:');
    if (!jobTitle) return;
    
    const companyName = prompt('Company Name:');
    if (!companyName) return;
    
    const startDate = prompt('Start Date (YYYY-MM-DD):');
    if (!startDate) return;
    
    const endDate = prompt('End Date (YYYY-MM-DD) or leave empty if current:');
    const description = prompt('Description (optional):');
    
    const user = await Auth.getCurrentUser();
    if (!user) return;
    
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
window.uploadProfilePicture = uploadProfilePicture;
