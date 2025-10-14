// Authentication Check - Protect Student Portal Pages
// This script runs on every page load to ensure user is logged in

(async function() {
    // Handle email verification callback
    // When users click verification link, Supabase adds auth tokens to URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    
    if (accessToken && type === 'signup') {
        console.log('Email verification successful! Logging you in...');
        // Clean up the URL
        window.history.replaceState({}, document.title, window.location.pathname);
        // Show success message
        alert('Email verified successfully! Welcome to Evenfall Advantage.');
    }
    
    // Check if user is logged in
    const isLoggedIn = await Auth.isLoggedIn();
    
    if (!isLoggedIn) {
        // Redirect to login page if not logged in
        window.location.href = 'login.html';
        return;
    }
    
    // Get current user
    const user = await Auth.getCurrentUser();
    
    if (user) {
        // Store user info globally
        window.currentUser = user;
        
        // Display user name in header if element exists
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement) {
            userNameElement.textContent = user.user_metadata.first_name || user.email;
        }
        
        // Log activity (temporarily disabled due to 409 error)
        // StudentData.logActivity(
        //     user.id,
        //     'page_view',
        //     `Viewed ${document.title}`
        // ).catch(err => console.warn('Activity logging failed:', err));
    }
})();

// Add logout functionality
function logout() {
    if (confirm('Are you sure you want to log out?')) {
        Auth.signOut().then(result => {
            if (result.success) {
                window.location.href = 'login.html';
            }
        });
    }
}

// Make logout available globally
window.logout = logout;
