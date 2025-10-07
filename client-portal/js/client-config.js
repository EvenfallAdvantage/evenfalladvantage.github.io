// Client Portal - Supabase Configuration

// Initialize Supabase
const SUPABASE_URL = 'https://vaagvairvwmgyzsmymhs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhYWd2YWlydndtZ3l6c215bWhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NjAzNTcsImV4cCI6MjA3NTMzNjM1N30.wCw2rcV2pJTXiKgKJE9BY3QHBWiRHgGPfdDPIeUsovM';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Authentication functions
const ClientAuth = {
    async getCurrentUser() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error) throw error;
            return user;
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    },

    async signOut() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Sign out error:', error);
        }
    }
};

// Client data functions
const ClientData = {
    async getProfile(clientId) {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .eq('id', clientId)
                .single();
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get profile error:', error);
            return { success: false, error: error.message };
        }
    },

    async updateProfile(clientId, profileData) {
        try {
            const { data, error } = await supabase
                .from('clients')
                .update(profileData)
                .eq('id', clientId);
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Update profile error:', error);
            return { success: false, error: error.message };
        }
    },

    async getJobPostings(clientId) {
        try {
            const { data, error } = await supabase
                .from('job_postings')
                .select('*')
                .eq('client_id', clientId)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get jobs error:', error);
            return { success: false, error: error.message };
        }
    },

    async createJobPosting(clientId, jobData) {
        try {
            const { data, error } = await supabase
                .from('job_postings')
                .insert({
                    client_id: clientId,
                    ...jobData
                });
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Create job error:', error);
            return { success: false, error: error.message };
        }
    },

    async updateJobPosting(jobId, jobData) {
        try {
            const { data, error } = await supabase
                .from('job_postings')
                .update(jobData)
                .eq('id', jobId);
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Update job error:', error);
            return { success: false, error: error.message };
        }
    },

    async deleteJobPosting(jobId) {
        try {
            const { error } = await supabase
                .from('job_postings')
                .delete()
                .eq('id', jobId);
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Delete job error:', error);
            return { success: false, error: error.message };
        }
    },

    async searchCandidates(filters = {}) {
        try {
            console.log('searchCandidates called with filters:', filters);
            
            // Get all students
            const { data: students, error: studentsError } = await supabase
                .from('students')
                .select('id, first_name, last_name, email');
            
            if (studentsError) throw studentsError;
            
            console.log('Students found:', students?.length);
            
            // Get all profiles
            const { data: profiles, error: profilesError } = await supabase
                .from('student_profiles')
                .select('*');
            
            if (profilesError) throw profilesError;
            
            console.log('Profiles found:', profiles?.length);
            
            // Manually join students with their profiles
            const data = students?.map(student => {
                const profile = profiles?.find(p => p.student_id === student.id);
                return {
                    ...student,
                    student_profiles: profile || null
                };
            }) || [];
            
            console.log('Joined data:', data.length);
            
            const error = null;
            
            if (error) throw error;
            
            // Filter for students with profiles and visible profiles
            let visibleData = data?.filter(student => {
                // Get profile (might be array or object)
                const profile = Array.isArray(student.student_profiles) 
                    ? student.student_profiles[0] 
                    : student.student_profiles;
                
                // Must have a profile
                if (!profile) {
                    console.log(`Student ${student.first_name} ${student.last_name} has no profile`);
                    return false;
                }
                
                // Check visibility - ONLY true is visible, false/null/undefined are hidden
                const isVisible = profile.profile_visible === true;
                
                if (!isVisible) {
                    console.log(`Student ${student.first_name} ${student.last_name} profile is not visible (value: ${profile.profile_visible})`);
                }
                
                return isVisible;
            }) || [];
            
            console.log(`After visibility filter: ${visibleData.length} students`);
            
            // Apply certification filter
            if (filters.certification === 'completed') {
                visibleData = visibleData.filter(student => {
                    const certs = student.student_profiles?.certifications_completed || [];
                    return certs.length > 0;
                });
                console.log(`After completed cert filter: ${visibleData.length} students`);
            } else if (filters.certification === 'in-progress') {
                visibleData = visibleData.filter(student => {
                    const certs = student.student_profiles?.certifications_in_progress || [];
                    return certs.length > 0;
                });
                console.log(`After in-progress cert filter: ${visibleData.length} students`);
            }
            
            return { success: true, data: visibleData };
        } catch (error) {
            console.error('Search candidates error:', error);
            return { success: false, error: error.message, data: [] };
        }
    }
};

// Logout function
function logout() {
    ClientAuth.signOut();
}

// Export
window.ClientAuth = ClientAuth;
window.ClientData = ClientData;
window.logout = logout;
