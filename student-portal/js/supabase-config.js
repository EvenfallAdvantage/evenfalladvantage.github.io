// Supabase Configuration
const SUPABASE_URL = 'https://vaagvairvwmgyzsmymhs.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhYWd2YWlydndtZ3l6c215bWhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NjAzNTcsImV4cCI6MjA3NTMzNjM1N30.wCw2rcV2pJTXiKgKJE9BY3QHBWiRHgGPfdDPIeUsovM'

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Authentication Functions
const Auth = {
    // Sign up new student
    async signUp(email, password, firstName, lastName) {
        try {
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        first_name: firstName,
                        last_name: lastName
                    }
                }
            })
            
            if (error) throw error
            
            // Create student profile
            if (data.user) {
                await this.createStudentProfile(data.user.id, firstName, lastName, email)
            }
            
            return { success: true, data }
        } catch (error) {
            console.error('Sign up error:', error)
            return { success: false, error: error.message }
        }
    },

    // Create student profile in database
    async createStudentProfile(userId, firstName, lastName, email) {
        try {
            const { data, error } = await supabase
                .from('students')
                .insert({
                    id: userId,
                    email: email,
                    first_name: firstName,
                    last_name: lastName
                })
            
            if (error) throw error
            
            // Create empty profile
            await supabase
                .from('student_profiles')
                .insert({
                    student_id: userId
                })
            
            return { success: true, data }
        } catch (error) {
            console.error('Profile creation error:', error)
            return { success: false, error: error.message }
        }
    },

    // Sign in
    async signIn(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            })
            
            if (error) throw error
            
            // Update last login
            await supabase
                .from('students')
                .update({ last_login: new Date().toISOString() })
                .eq('id', data.user.id)
            
            return { success: true, data }
        } catch (error) {
            console.error('Sign in error:', error)
            return { success: false, error: error.message }
        }
    },

    // Sign out
    async signOut() {
        try {
            const { error } = await supabase.auth.signOut()
            if (error) throw error
            return { success: true }
        } catch (error) {
            console.error('Sign out error:', error)
            return { success: false, error: error.message }
        }
    },

    // Get current user
    async getCurrentUser() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            return user
        } catch (error) {
            console.error('Get user error:', error)
            return null
        }
    },

    // Check if user is logged in
    async isLoggedIn() {
        const user = await this.getCurrentUser()
        return user !== null
    }
}

// Student Data Functions
const StudentData = {
    // Get student profile
    async getProfile(studentId) {
        try {
            const { data, error } = await supabase
                .from('student_profiles')
                .select('*')
                .eq('student_id', studentId)
                .single()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Get profile error:', error)
            return { success: false, error: error.message }
        }
    },

    // Update student profile
    async updateProfile(studentId, profileData) {
        try {
            const { data, error } = await supabase
                .from('student_profiles')
                .update(profileData)
                .eq('student_id', studentId)
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Update profile error:', error)
            return { success: false, error: error.message }
        }
    },

    // Get module progress
    async getModuleProgress(studentId) {
        try {
            const { data, error } = await supabase
                .from('student_module_progress')
                .select(`
                    *,
                    training_modules (
                        module_name,
                        module_code,
                        description
                    )
                `)
                .eq('student_id', studentId)
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Get progress error:', error)
            return { success: false, error: error.message }
        }
    },

    // Update module progress
    async updateModuleProgress(studentId, moduleId, progressData) {
        try {
            const { data, error } = await supabase
                .from('student_module_progress')
                .upsert({
                    student_id: studentId,
                    module_id: moduleId,
                    ...progressData,
                    status: progressData.progress_percentage === 100 ? 'completed' : 'in_progress'
                })
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Update progress error:', error)
            return { success: false, error: error.message }
        }
    },

    // Get assessment results
    async getAssessmentResults(studentId) {
        try {
            const { data, error } = await supabase
                .from('assessment_results')
                .select(`
                    *,
                    assessments (
                        assessment_name,
                        total_questions,
                        passing_score
                    )
                `)
                .eq('student_id', studentId)
                .order('completed_at', { ascending: false })
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Get results error:', error)
            return { success: false, error: error.message }
        }
    },

    // Save assessment result
    async saveAssessmentResult(studentId, assessmentId, resultData) {
        try {
            const { data, error } = await supabase
                .from('assessment_results')
                .insert({
                    student_id: studentId,
                    assessment_id: assessmentId,
                    ...resultData
                })
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Save result error:', error)
            return { success: false, error: error.message }
        }
    },

    // Log activity
    async logActivity(studentId, activityType, description) {
        try {
            const { data, error } = await supabase
                .from('activity_log')
                .insert({
                    student_id: studentId,
                    activity_type: activityType,
                    activity_description: description
                })
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Log activity error:', error)
            return { success: false, error: error.message }
        }
    }
}

// Training Module Functions
const TrainingData = {
    // Get all modules
    async getAllModules() {
        try {
            const { data, error } = await supabase
                .from('training_modules')
                .select('*')
                .order('module_code')
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Get modules error:', error)
            return { success: false, error: error.message }
        }
    },

    // Get module by code
    async getModuleByCode(moduleCode) {
        try {
            const { data, error } = await supabase
                .from('training_modules')
                .select('*')
                .eq('module_code', moduleCode)
                .single()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Get module error:', error)
            return { success: false, error: error.message }
        }
    }
}

// Export for use in other files
window.Auth = Auth
window.StudentData = StudentData
window.TrainingData = TrainingData
