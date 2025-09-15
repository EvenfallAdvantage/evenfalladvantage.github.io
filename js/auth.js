/**
 * Authentication functionality for Evenfall Advantage client portal
 */

// Store user data in localStorage for demo purposes
// In a real application, this would use a secure backend
const AUTH_STORAGE_KEY = 'evenfallAdvantageAuth';
const USERS_STORAGE_KEY = 'evenfallAdvantageUsers';

// Initialize default users if none exist
function initializeUsers() {
    if (!localStorage.getItem(USERS_STORAGE_KEY)) {
        const defaultUsers = [
            {
                email: 'john.doe@example.com',
                password: 'Password123!', // In a real app, this would be hashed
                firstName: 'John',
                lastName: 'Doe',
                phone: '555-123-4567',
                companyName: 'Acme Corporation',
                jobTitle: 'Security Director',
                companySize: '51-200',
                industry: 'technology',
                address: '123 Main Street',
                city: 'Anytown',
                state: 'CA',
                zip: '90210',
                services: ['security-consulting', 'training']
            },
            {
                email: 'jane.smith@example.com',
                password: 'Password456!',
                firstName: 'Jane',
                lastName: 'Smith',
                phone: '555-987-6543',
                companyName: 'Globex Industries',
                jobTitle: 'Event Manager',
                companySize: '201-500',
                industry: 'events',
                address: '456 Oak Avenue',
                city: 'Metropolis',
                state: 'NY',
                zip: '10001',
                services: ['festival-safety', 'emergency-planning']
            }
        ];
        
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(defaultUsers));
    }
}

// Check if user is logged in
function isLoggedIn() {
    return localStorage.getItem(AUTH_STORAGE_KEY) !== null;
}

// Get current user information
function getCurrentUser() {
    const authData = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!authData) return null;
    
    try {
        return JSON.parse(authData);
    } catch (e) {
        console.error('Error parsing auth data:', e);
        return null;
    }
}

// Login function
function login(email, password, rememberMe = false) {
    // Get users from storage
    const users = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]');
    
    // Find matching user
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    
    if (user) {
        // Create a copy of user without the password
        const userInfo = { ...user };
        delete userInfo.password;
        
        // Store auth data
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userInfo));
        
        return {
            success: true,
            user: userInfo
        };
    } else {
        return {
            success: false,
            message: 'Invalid email or password'
        };
    }
}

// Logout function
function logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.href = 'login.html';
}

// Register function
function register(userData) {
    // Get existing users
    const users = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]');
    
    // Check if email already exists
    if (users.some(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
        return {
            success: false,
            message: 'Email is already registered'
        };
    }
    
    // Add new user
    users.push(userData);
    
    // Update storage
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    
    // Login the new user
    return login(userData.email, userData.password);
}

// Redirect if not logged in (for protected pages)
function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
    }
}

// Redirect if already logged in (for login/register pages)
function redirectIfLoggedIn() {
    if (isLoggedIn()) {
        window.location.href = 'dashboard.html';
    }
}

// Initialize the authentication system
function initAuth() {
    initializeUsers();
}

// Run initialization
document.addEventListener('DOMContentLoaded', initAuth);
