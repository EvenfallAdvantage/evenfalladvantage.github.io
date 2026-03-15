/**
 * Login page functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    // Redirect if already logged in
    redirectIfLoggedIn();
    
    const loginForm = document.querySelector('.login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const rememberMeCheckbox = document.getElementById('remember');
    
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Basic form validation
            if (!emailInput.value.trim()) {
                showError(emailInput, 'Email is required');
                return;
            }
            
            if (!passwordInput.value.trim()) {
                showError(passwordInput, 'Password is required');
                return;
            }
            
            // Attempt login
            const result = login(
                emailInput.value.trim(),
                passwordInput.value,
                rememberMeCheckbox.checked
            );
            
            if (result.success) {
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            } else {
                // Show error message
                showLoginError(result.message || 'Invalid login credentials');
            }
        });
    }
    
    // Helper functions
    function showError(inputElement, message) {
        // Remove existing error messages
        const existingError = inputElement.parentElement.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        // Create error message
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        
        // Add error styling
        inputElement.classList.add('error');
        
        // Add error message after the input
        inputElement.parentElement.appendChild(errorElement);
    }
    
    function showLoginError(message) {
        // Check if error container exists, create if not
        let errorContainer = document.querySelector('.login-error');
        if (!errorContainer) {
            errorContainer = document.createElement('div');
            errorContainer.className = 'login-error';
            
            // Insert before the form
            loginForm.parentElement.insertBefore(errorContainer, loginForm);
        }
        
        // Set the error message
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
    }
});
