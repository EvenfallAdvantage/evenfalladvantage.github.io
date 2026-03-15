/**
 * Profile management functionality for dashboard
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize profile management functionality
    initProfileManagement();
    
    /**
     * Sets up profile management functionality
     */
    function initProfileManagement() {
        // Get the current user data
        const userData = getCurrentUser();
        
        if (!userData) return;
        
        // Populate profile form with user data
        populateProfileForm(userData);
        
        // Initialize avatar upload functionality
        initAvatarUpload();
        
        // Initialize form submission
        initProfileFormSubmission();
        
        // Initialize password change
        initPasswordChange();
    }
    
    /**
     * Populates profile form fields with user data
     */
    function populateProfileForm(user) {
        // Basic profile info
        document.querySelector('.profile-info h4').textContent = `${user.firstName} ${user.lastName}`;
        document.querySelector('.profile-info p').textContent = user.companyName || '';
        
        // Form fields mapping
        const fieldMappings = {
            'first-name': 'firstName',
            'last-name': 'lastName',
            'email': 'email',
            'phone': 'phone',
            'company': 'companyName',
            'job-title': 'jobTitle',
            'address': 'address',
            'city': 'city',
            'state': 'state',
            'zip': 'zip'
        };
        
        // Set values for all fields
        for (const [fieldId, userProp] of Object.entries(fieldMappings)) {
            const field = document.getElementById(fieldId);
            if (field && user[userProp]) {
                field.value = user[userProp];
            }
        }
    }
    
    /**
     * Initializes avatar upload functionality
     */
    function initAvatarUpload() {
        const changeAvatarButton = document.querySelector('.change-avatar');
        
        if (changeAvatarButton) {
            changeAvatarButton.addEventListener('click', function() {
                // Create a file input element
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.style.display = 'none';
                
                // Append to body and trigger click
                document.body.appendChild(fileInput);
                fileInput.click();
                
                // Listen for file selection
                fileInput.addEventListener('change', function() {
                    if (this.files && this.files[0]) {
                        const reader = new FileReader();
                        
                        reader.onload = function(e) {
                            // Update avatar image
                            const avatarImg = document.querySelector('.profile-avatar img');
                            if (avatarImg) {
                                avatarImg.src = e.target.result;
                                
                                // In a real app, you'd upload this to a server
                                // For now, just store in local storage
                                const userData = getCurrentUser();
                                if (userData) {
                                    userData.avatar = e.target.result;
                                    localStorage.setItem('evenfallAdvantageAuth', JSON.stringify(userData));
                                }
                            }
                        };
                        
                        reader.readAsDataURL(this.files[0]);
                    }
                    
                    // Remove the temporary input
                    document.body.removeChild(fileInput);
                });
            });
        }
    }
    
    /**
     * Initializes profile form submission
     */
    function initProfileFormSubmission() {
        const profileForm = document.querySelector('.profile-form');
        const saveButton = document.querySelector('.save-button');
        
        if (profileForm && saveButton) {
            saveButton.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Get current user data
                const userData = getCurrentUser();
                if (!userData) return;
                
                // Update user data with form values
                userData.firstName = document.getElementById('first-name').value;
                userData.lastName = document.getElementById('last-name').value;
                userData.phone = document.getElementById('phone').value;
                userData.companyName = document.getElementById('company').value;
                userData.jobTitle = document.getElementById('job-title').value;
                userData.address = document.getElementById('address').value;
                userData.city = document.getElementById('city').value;
                userData.state = document.getElementById('state').value;
                userData.zip = document.getElementById('zip').value;
                
                // In a real app, you'd send this to a server
                // For now, just update local storage
                localStorage.setItem('evenfallAdvantageAuth', JSON.stringify(userData));
                
                // Update profile header
                document.querySelector('.profile-info h4').textContent = `${userData.firstName} ${userData.lastName}`;
                document.querySelector('.profile-info p').textContent = userData.companyName;
                
                // Also update welcome message in dashboard
                const welcomeText = document.querySelector('.welcome-text strong');
                if (welcomeText) {
                    welcomeText.textContent = `${userData.firstName} ${userData.lastName}`;
                }
                
                // Update company name in dashboard
                const companyName = document.querySelector('.company-name');
                if (companyName) {
                    companyName.textContent = userData.companyName;
                }
                
                // Show success message
                showProfileUpdateSuccess();
            });
        }
    }
    
    /**
     * Initializes password change functionality
     */
    function initPasswordChange() {
        const passwordFields = {
            current: document.getElementById('current-password'),
            new: document.getElementById('new-password'),
            confirm: document.getElementById('confirm-password')
        };
        
        const changePasswordButton = document.getElementById('change-password');
        
        if (changePasswordButton && passwordFields.current && passwordFields.new && passwordFields.confirm) {
            changePasswordButton.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Basic validation
                if (!passwordFields.current.value) {
                    showPasswordError('Please enter your current password');
                    return;
                }
                
                if (!passwordFields.new.value) {
                    showPasswordError('Please enter a new password');
                    return;
                }
                
                if (passwordFields.new.value !== passwordFields.confirm.value) {
                    showPasswordError('New passwords do not match');
                    return;
                }
                
                // Password strength validation
                if (passwordFields.new.value.length < 8) {
                    showPasswordError('Password must be at least 8 characters');
                    return;
                }
                
                if (!/\d/.test(passwordFields.new.value) || !/[!@#$%^&*(),.?":{}|<>]/.test(passwordFields.new.value)) {
                    showPasswordError('Password must include a number and special character');
                    return;
                }
                
                // In a real app, you'd verify the current password on the server
                // For this demo, we'll simulate by checking against our mock users
                const userData = getCurrentUser();
                const users = JSON.parse(localStorage.getItem('evenfallAdvantageUsers') || '[]');
                
                const currentUser = users.find(u => u.email === userData.email);
                
                if (!currentUser || currentUser.password !== passwordFields.current.value) {
                    showPasswordError('Current password is incorrect');
                    return;
                }
                
                // Update the password
                currentUser.password = passwordFields.new.value;
                localStorage.setItem('evenfallAdvantageUsers', JSON.stringify(users));
                
                // Clear fields and show success
                passwordFields.current.value = '';
                passwordFields.new.value = '';
                passwordFields.confirm.value = '';
                
                showPasswordUpdateSuccess();
            });
        }
    }
    
    /**
     * Shows profile update success message
     */
    function showProfileUpdateSuccess() {
        const messageContainer = document.querySelector('.profile-message');
        
        if (!messageContainer) {
            const container = document.createElement('div');
            container.className = 'profile-message success';
            container.innerHTML = '<i class="fas fa-check-circle"></i> Your profile has been updated successfully.';
            
            const profileForm = document.querySelector('.profile-form');
            if (profileForm) {
                profileForm.appendChild(container);
                
                // Remove the message after a delay
                setTimeout(() => {
                    if (container.parentNode) {
                        container.parentNode.removeChild(container);
                    }
                }, 3000);
            }
        }
    }
    
    /**
     * Shows password error message
     */
    function showPasswordError(message) {
        const errorContainer = document.querySelector('.password-error');
        
        if (!errorContainer) {
            const container = document.createElement('div');
            container.className = 'password-error error-message';
            container.textContent = message;
            
            const passwordSection = document.querySelector('.form-section:last-child');
            if (passwordSection) {
                passwordSection.appendChild(container);
                
                // Remove the message after a delay
                setTimeout(() => {
                    if (container.parentNode) {
                        container.parentNode.removeChild(container);
                    }
                }, 3000);
            }
        } else {
            errorContainer.textContent = message;
        }
    }
    
    /**
     * Shows password update success message
     */
    function showPasswordUpdateSuccess() {
        const messageContainer = document.querySelector('.password-message');
        
        if (!messageContainer) {
            const container = document.createElement('div');
            container.className = 'password-message success';
            container.innerHTML = '<i class="fas fa-check-circle"></i> Your password has been updated successfully.';
            
            const passwordSection = document.querySelector('.form-section:last-child');
            if (passwordSection) {
                passwordSection.appendChild(container);
                
                // Remove the message after a delay
                setTimeout(() => {
                    if (container.parentNode) {
                        container.parentNode.removeChild(container);
                    }
                }, 3000);
            }
        }
    }
});
