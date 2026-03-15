/**
 * Form validation script for Evenfall Advantage estimate request forms
 */

document.addEventListener('DOMContentLoaded', function() {
    // Get all forms
    const forms = document.querySelectorAll('.estimate-form');
    
    forms.forEach(form => {
        // Add submission handler
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Run validation
            if (validateForm(form)) {
                // If validation passes, simulate form submission
                handleFormSubmission(form);
            }
        });
        
        // Add input validation on blur for required fields
        const requiredInputs = form.querySelectorAll('input[required], textarea[required], select[required]');
        requiredInputs.forEach(input => {
            input.addEventListener('blur', function() {
                validateField(input);
            });
        });
    });
    
    /**
     * Validates an individual form field
     * @param {HTMLElement} field - The field to validate
     * @return {boolean} - Whether the field is valid
     */
    function validateField(field) {
        const fieldType = field.type;
        const value = field.value.trim();
        const formGroup = field.closest('.form-group');
        let isValid = true;
        let errorMessage = '';
        
        // Remove any existing error messages
        const existingError = formGroup.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        formGroup.classList.remove('error');
        
        // Check if field is required and empty
        if (field.hasAttribute('required') && !value) {
            isValid = false;
            errorMessage = 'This field is required';
        }
        // Email validation
        else if (fieldType === 'email' && value) {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid email address';
            }
        }
        // Phone validation (basic, allows different formats)
        else if (field.id.includes('phone') && value) {
            const phonePattern = /^[0-9()\-\s\.+]{7,20}$/;
            if (!phonePattern.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid phone number';
            }
        }
        
        // Display error message if invalid
        if (!isValid) {
            formGroup.classList.add('error');
            const errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            errorElement.textContent = errorMessage;
            formGroup.appendChild(errorElement);
        }
        
        return isValid;
    }
    
    /**
     * Validates an entire form
     * @param {HTMLFormElement} form - The form to validate
     * @return {boolean} - Whether the form is valid
     */
    function validateForm(form) {
        const requiredFields = form.querySelectorAll('input[required], textarea[required], select[required]');
        let isFormValid = true;
        
        // Validate all required fields
        requiredFields.forEach(field => {
            if (!validateField(field)) {
                isFormValid = false;
            }
        });
        
        // Checkbox validation - ensure at least one is checked when in a group
        const checkboxGroups = form.querySelectorAll('.checkbox-group');
        checkboxGroups.forEach(group => {
            // Only validate groups that contain at least one required checkbox
            const hasRequiredCheckbox = group.querySelector('input[type="checkbox"][required]');
            if (hasRequiredCheckbox) {
                const checkboxes = group.querySelectorAll('input[type="checkbox"]');
                const isChecked = Array.from(checkboxes).some(checkbox => checkbox.checked);
                
                const formGroup = group.closest('.form-group');
                const existingError = formGroup.querySelector('.error-message');
                if (existingError) {
                    existingError.remove();
                }
                formGroup.classList.remove('error');
                
                if (!isChecked) {
                    isFormValid = false;
                    formGroup.classList.add('error');
                    const errorElement = document.createElement('div');
                    errorElement.className = 'error-message';
                    errorElement.textContent = 'Please select at least one option';
                    formGroup.appendChild(errorElement);
                }
            }
        });
        
        return isFormValid;
    }
    
    /**
     * Handles form submission
     * @param {HTMLFormElement} form - The form being submitted
     */
    function handleFormSubmission(form) {
        // Get form ID to determine which form was submitted
        const formId = form.id;
        
        // Get form data
        const formData = new FormData(form);
        const formValues = {};
        
        // Handle form data entries, properly collecting multiple values for checkboxes
        for (const [key, value] of formData.entries()) {
            // If this is a checkbox (we're checking if the same key appears multiple times)
            if (formValues.hasOwnProperty(key)) {
                // If it's the first duplicate, convert to array
                if (!Array.isArray(formValues[key])) {
                    formValues[key] = [formValues[key]];
                }
                // Add the new value to the array
                formValues[key].push(value);
            } else {
                // First time seeing this key
                formValues[key] = value;
            }
        }
        
        // Determine which form was submitted to create appropriate subject line
        let subject = 'Estimate Request';
        let formType = '';
        
        if (formId === 'security-consulting-form') {
            subject = 'Security Consulting - Estimate Request';
            formType = 'Security Consulting';
        } else if (formId === 'training-form') {
            subject = 'Training & Certification - Estimate Request';
            formType = 'Training & Certification';
        } else if (formId === 'festival-venue-form') {
            subject = 'Festival & Venue Safety - Estimate Request';
            formType = 'Festival & Venue Safety';
        } else if (formId === 'emergency-planning-form') {
            subject = 'Emergency Response Planning - Estimate Request';
            formType = 'Emergency Response Planning';
        }
        
        // Construct email body
        let emailBody = `${formType.toUpperCase()} ESTIMATE REQUEST\n\n`;
        
        // Add form values to email body
        for (const [key, value] of Object.entries(formValues)) {
            if (value) {
                // Format the field name for readability
                const fieldName = key.replace(/-/g, ' ')
                    .replace(/(^|\s)\S/g, function(t) { return t.toUpperCase(); });
                
                // Handle arrays (multiple checkbox selections)
                if (Array.isArray(value)) {
                    emailBody += `${fieldName}: ${value.join(', ')}\n`;
                } else {
                    emailBody += `${fieldName}: ${value}\n`;
                }
            }
        }
        
        // Create mailto URL
        const mailtoURL = `mailto:contact@evenfalladvantage.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
        
        // Open email client
        window.location.href = mailtoURL;
        
        // Hide the form
        form.style.display = 'none';
        
        // Show success message
        const formContainer = document.querySelector('.form-container');
        const successMessage = document.createElement('div');
        successMessage.className = 'form-success';
        
        successMessage.innerHTML = `
            <h3>Thank You!</h3>
            <p>Your email client has been opened with your estimate request. Please send the email to complete your submission.</p>
            <p>We typically respond to estimate requests within 1-2 business days.</p>
            <p><a href="../index.html">Return to homepage</a></p>
            <p><small>If your email client did not open, please contact us directly at contact@evenfalladvantage.com</small></p>
        `;
        
        formContainer.appendChild(successMessage);
        
        // Scroll to top of the form container
        formContainer.scrollIntoView({ behavior: 'smooth' });
    }
});
