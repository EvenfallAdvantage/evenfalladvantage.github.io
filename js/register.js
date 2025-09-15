/**
 * Registration page functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    // Redirect if already logged in
    redirectIfLoggedIn();
    
    const registerForms = document.querySelectorAll('.register-form');
    const nextButtons = document.querySelectorAll('.next-button');
    const backButtons = document.querySelectorAll('.back-button');
    const processSteps = document.querySelectorAll('.process-step');
    const submitButton = document.querySelector('.submit-button');
    
    // Form data object to collect data across steps
    let formData = {};
    
    // Initialize form validation
    initFormValidation();
    
    // Next button functionality
    nextButtons.forEach(button => {
        button.addEventListener('click', function() {
            const currentForm = this.closest('.register-form');
            const nextStepId = this.getAttribute('data-next');
            const nextStep = document.getElementById(nextStepId);
            const currentStepNumber = parseInt(currentForm.id.replace('step', ''));
            const nextStepNumber = parseInt(nextStepId.replace('step', ''));
            
            // Validate current step
            if (validateStep(currentForm)) {
                // Store form data
                collectFormData(currentForm);
                
                // Update process steps indicator
                processSteps.forEach((step, index) => {
                    if (index + 1 === nextStepNumber) {
                        step.classList.add('active');
                    }
                });
                
                // If moving to verification step, populate the summary
                if (nextStepId === 'step3') {
                    populateVerification();
                }
                
                // Hide current form, show next form
                currentForm.classList.remove('active-step');
                nextStep.classList.add('active-step');
            }
        });
    });
    
    // Back button functionality
    backButtons.forEach(button => {
        button.addEventListener('click', function() {
            const currentForm = this.closest('.register-form');
            const prevStepId = this.getAttribute('data-back');
            const prevStep = document.getElementById(prevStepId);
            const currentStepNumber = parseInt(currentForm.id.replace('step', ''));
            
            // Update process steps indicator
            processSteps.forEach((step, index) => {
                if (index + 1 === currentStepNumber) {
                    step.classList.remove('active');
                }
            });
            
            // Hide current form, show previous form
            currentForm.classList.remove('active-step');
            prevStep.classList.add('active-step');
        });
    });
    
    // Form submission
    if (submitButton) {
        submitButton.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Check terms acceptance
            const termsCheckbox = document.querySelector('input[name="terms"]');
            if (!termsCheckbox.checked) {
                alert('Please accept the Terms of Service and Privacy Policy.');
                return;
            }
            
            // Final data collection
            collectFormData(document.getElementById('step3'));
            
            // Format the data for registration
            const userData = {
                email: formData.email,
                password: formData.password,
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone,
                companyName: formData.companyName,
                jobTitle: formData.jobTitle,
                companySize: formData.companySize,
                industry: formData.industry,
                address: formData.address,
                city: formData.city,
                state: formData.state,
                zip: formData.zip,
                services: formData.services || []
            };
            
            // Register the user
            const result = register(userData);
            
            if (result.success) {
                // Hide the form and show success message
                const currentForm = this.closest('.register-form');
                currentForm.classList.remove('active-step');
                document.getElementById('success-message').classList.add('active-step');
                
                // Redirect to dashboard after a delay
                setTimeout(function() {
                    window.location.href = 'dashboard.html';
                }, 3000);
            } else {
                // Show error message
                alert(result.message || 'Registration failed. Please try again.');
            }
        });
    }
    
    // Helper functions
    function initFormValidation() {
        // Add validation event listeners for important fields
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirm-password');
        
        if (emailInput) {
            emailInput.addEventListener('blur', function() {
                validateEmail(this);
            });
        }
        
        if (passwordInput) {
            passwordInput.addEventListener('blur', function() {
                validatePassword(this);
            });
        }
        
        if (confirmPasswordInput && passwordInput) {
            confirmPasswordInput.addEventListener('blur', function() {
                validateConfirmPassword(this, passwordInput);
            });
        }
    }
    
    function validateStep(formElement) {
        let isValid = true;
        const requiredFields = formElement.querySelectorAll('[required]');
        
        // Clear all errors first
        formElement.querySelectorAll('.error-message').forEach(error => error.remove());
        formElement.querySelectorAll('.error').forEach(field => field.classList.remove('error'));
        
        // Check required fields
        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                showError(field, 'This field is required');
                isValid = false;
            } else if (field.id === 'email') {
                isValid = validateEmail(field) && isValid;
            } else if (field.id === 'password') {
                isValid = validatePassword(field) && isValid;
            } else if (field.id === 'confirm-password') {
                isValid = validateConfirmPassword(field, document.getElementById('password')) && isValid;
            }
        });
        
        return isValid;
    }
    
    function validateEmail(field) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(field.value)) {
            showError(field, 'Please enter a valid email address');
            return false;
        }
        return true;
    }
    
    function validatePassword(field) {
        if (field.value.length < 8) {
            showError(field, 'Password must be at least 8 characters');
            return false;
        }
        
        // Check for number and special character
        const hasNumber = /\d/.test(field.value);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(field.value);
        
        if (!hasNumber || !hasSpecial) {
            showError(field, 'Password must include a number and special character');
            return false;
        }
        
        return true;
    }
    
    function validateConfirmPassword(field, passwordField) {
        if (field.value !== passwordField.value) {
            showError(field, 'Passwords do not match');
            return false;
        }
        return true;
    }
    
    function showError(inputElement, message) {
        // Remove existing error message
        const existingError = inputElement.parentElement.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        // Create and add error message
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        
        // Add error class to input
        inputElement.classList.add('error');
        
        // Add error message after the input
        inputElement.parentElement.appendChild(errorElement);
    }
    
    function collectFormData(formElement) {
        // Get all form inputs
        const inputs = formElement.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            // Handle checkboxes for services
            if (input.type === 'checkbox' && input.name === 'services') {
                if (!formData.services) {
                    formData.services = [];
                }
                
                if (input.checked) {
                    formData.services.push(input.value);
                }
            } 
            // Handle other fields
            else if (input.name && input.name !== 'terms') {
                formData[input.name] = input.value;
            }
        });
        
        // Special handling for the firstName and lastName
        const firstNameInput = formElement.querySelector('#first-name');
        const lastNameInput = formElement.querySelector('#last-name');
        
        if (firstNameInput) {
            formData.firstName = firstNameInput.value;
        }
        
        if (lastNameInput) {
            formData.lastName = lastNameInput.value;
        }
    }
    
    function populateVerification() {
        document.getElementById('verify-email').textContent = formData.email || '';
        document.getElementById('verify-name').textContent = 
            (formData.firstName || '') + ' ' + (formData.lastName || '');
        document.getElementById('verify-phone').textContent = formData.phone || '';
        document.getElementById('verify-company').textContent = formData.companyName || '';
        document.getElementById('verify-job').textContent = formData.jobTitle || '';
        
        // Industry text from select
        const industrySelect = document.getElementById('industry');
        const selectedOption = industrySelect.options[industrySelect.selectedIndex];
        document.getElementById('verify-industry').textContent = selectedOption ? selectedOption.text : '';
        
        // Address
        document.getElementById('verify-address').textContent = 
            (formData.address || '') + ', ' +
            (formData.city || '') + ', ' +
            (formData.state || '') + ' ' +
            (formData.zip || '');
        
        // Services
        const selectedServices = [];
        document.querySelectorAll('input[name="services"]:checked').forEach(checkbox => {
            selectedServices.push(checkbox.parentNode.textContent.trim());
        });
        
        document.getElementById('verify-services').textContent = 
            selectedServices.length > 0 ? selectedServices.join(', ') : 'None selected';
    }
});
