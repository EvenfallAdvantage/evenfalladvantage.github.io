// Authentication Check - Protect Student Portal Pages
// This script runs on every page load to ensure user is logged in

(async function() {
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
