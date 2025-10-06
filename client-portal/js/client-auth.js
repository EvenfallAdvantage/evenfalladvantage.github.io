// Client Portal Authentication

// Initialize Supabase
const SUPABASE_URL = 'https://vaagvairvwmgyzsmymhs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhYWd2YWlydndtZ3l6c215bWhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NjAzNTcsImV4cCI6MjA3NTMzNjM1N30.wCw2rcV2pJTXiKgKJE9BY3QHBWiRHgGPfdDPIeUsovM';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Tab switching
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Remove active class from all tabs and forms
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding form
        tab.classList.add('active');
        document.getElementById(`${tabName}Form`).classList.add('active');
        
        hideAlert();
    });
});

// Show alert
function showAlert(message, type) {
    const alert = document.getElementById('alert');
    alert.textContent = message;
    alert.className = `alert ${type} show`;
}

// Hide alert
function hideAlert() {
    const alert = document.getElementById('alert');
    alert.classList.remove('show');
}

// Login form handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        // Check if user is a client
        const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('*')
            .eq('id', data.user.id)
            .single();
        
        if (clientError || !clientData) {
            await supabase.auth.signOut();
            throw new Error('This account is not registered as a client. Please sign up for a client account.');
        }
        
        showAlert('Login successful! Redirecting...', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
        
    } catch (error) {
        showAlert(error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
    }
});

// Signup form handler
document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const companyName = document.getElementById('company-name').value;
    const firstName = document.getElementById('first-name').value;
    const lastName = document.getElementById('last-name').value;
    const email = document.getElementById('signup-email').value;
    const phone = document.getElementById('phone').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    // Validate passwords match
    if (password !== confirmPassword) {
        showAlert('Passwords do not match', 'error');
        return;
    }
    
    // Validate password length
    if (password.length < 8) {
        showAlert('Password must be at least 8 characters', 'error');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
    
    try {
        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    user_type: 'client'
                }
            }
        });
        
        if (authError) throw authError;
        
        // Create client profile
        const { error: clientError } = await supabase
            .from('clients')
            .insert({
                id: authData.user.id,
                company_name: companyName,
                contact_name: `${firstName} ${lastName}`,
                email: email,
                phone: phone
            });
        
        if (clientError) throw clientError;
        
        showAlert('Account created successfully! You can now login.', 'success');
        setTimeout(() => {
            // Switch to login tab
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            document.querySelector('[data-tab="login"]').classList.add('active');
            document.getElementById('loginForm').classList.add('active');
            document.getElementById('login-email').value = email;
        }, 2000);
        
    } catch (error) {
        showAlert(error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
    }
});

// Export for use in other files
window.supabase = supabase;
