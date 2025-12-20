// Supabase Configuration
const SUPABASE_URL = 'https://vaagvairvwmgyzsmymhs.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_IPcFlKw8LEGnk2NYg5qrsw_Rq8yIhR1'

// Check if Supabase library is loaded
if (typeof window.supabase === 'undefined') {
    console.error('Supabase library not loaded! Make sure the CDN script is included before this file.');
    throw new Error('Supabase library not loaded');
}

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Authentication Functions
const Auth = {
    // Sign up new student
    async signUp(email, password, firstName, lastName) {
        try {
            console.log('Attempting signup for:', email);
            
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
            
            console.log('Auth signup response:', { data, error });
            
            if (error) throw error
            
            // Create student profile
            if (data.user) {
                console.log('Creating student profile for user:', data.user.id);
                const profileResult = await this.createStudentProfile(data.user.id, firstName, lastName, email);
                console.log('Profile creation result:', profileResult);
            }
            
            return { success: true, data }
        } catch (error) {
            console.error('Sign up error:', error);
            console.error('Error details:', error.message, error.code);
            return { success: false, error: error.message }
        }
    },

    // Create student profile in database
    async createStudentProfile(userId, firstName, lastName, email) {
        try {
            console.log('Inserting into students table:', { userId, email, firstName, lastName });
            
            const { data, error } = await supabase
                .from('students')
                .insert({
                    id: userId,
                    email: email,
                    first_name: firstName,
                    last_name: lastName
                })
            
            console.log('Students table insert result:', { data, error });
            
            if (error) {
                console.error('Students table error:', error);
                throw error;
            }
            
            // Create empty profile
            console.log('Inserting into student_profiles table');
            const profileResult = await supabase
                .from('student_profiles')
                .insert({
                    student_id: userId
                })
            
            console.log('Student_profiles insert result:', profileResult);
            
            if (profileResult.error) {
                console.error('Profile table error:', profileResult.error);
            }
            
            return { success: true, data }
        } catch (error) {
            console.error('Profile creation error:', error);
            console.error('Error details:', error.message, error.hint, error.details);
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
            console.log('Updating module progress:', { studentId, moduleId, progressData });
            
            // First, try to check if record exists
            const { data: existing, error: checkError } = await supabase
                .from('student_module_progress')
                .select('id')
                .eq('student_id', studentId)
                .eq('module_id', moduleId)
                .maybeSingle(); // Use maybeSingle instead of single
            
            console.log('Existing record check:', { existing, checkError });
            
            // Ignore "no rows" errors
            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }
            
            let result;
            if (existing) {
                // Update existing record
                result = await supabase
                    .from('student_module_progress')
                    .update({
                        ...progressData,
                        status: progressData.progress_percentage === 100 ? 'completed' : 'in_progress'
                    })
                    .eq('student_id', studentId)
                    .eq('module_id', moduleId);
            } else {
                // Insert new record
                result = await supabase
                    .from('student_module_progress')
                    .insert({
                        student_id: studentId,
                        module_id: moduleId,
                        ...progressData,
                        status: progressData.progress_percentage === 100 ? 'completed' : 'in_progress'
                    });
            }
            
            if (result.error) throw result.error;
            return { success: true, data: result.data }
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
                        module_id,
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

    // Save assessment result (upsert to avoid duplicates)
    async saveAssessmentResult(studentId, assessmentId, resultData) {
        try {
            // For Module 7 with state_code, check for existing result for this specific state
            let query = supabase
                .from('assessment_results')
                .select('id, score, state_code')
                .eq('student_id', studentId)
                .eq('assessment_id', assessmentId);
            
            // If this has a state_code (Module 7), filter by that state
            if (resultData.state_code) {
                query = query.eq('state_code', resultData.state_code);
            } else {
                // For non-Module 7, ensure we're not looking at Module 7 results
                query = query.is('state_code', null);
            }
            
            const { data: existing, error: checkError } = await query
                .order('completed_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            
            // Only insert if this is a new attempt or a better score for this state
            if (!existing || resultData.score > existing.score) {
                const { data, error } = await supabase
                    .from('assessment_results')
                    .insert({
                        student_id: studentId,
                        assessment_id: assessmentId,
                        ...resultData
                    });
                
                if (error) throw error;
                const stateInfo = resultData.state_code ? ` for ${resultData.state_code}` : '';
                console.log(`Saved new assessment result${stateInfo} (score: ${resultData.score})`);
                return { success: true, data };
            } else {
                const stateInfo = resultData.state_code ? ` for ${resultData.state_code}` : '';
                console.log(`Skipped saving${stateInfo} - existing score is higher or equal`);
                return { success: true, skipped: true };
            }
        } catch (error) {
            console.error('Save result error:', error);
            return { success: false, error: error.message };
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
            
            if (error) {
                console.warn('Activity logging failed (non-critical):', error.message);
                return { success: false, error: error.message };
            }
            return { success: true, data }
        } catch (error) {
            console.warn('Activity logging error (non-critical):', error.message);
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
                .maybeSingle()
            
            if (error) throw error
            
            // If no module found, return error
            if (!data) {
                console.warn(`No module found with code: ${moduleCode}`);
                return { success: false, error: 'Module not found' }
            }
            
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
