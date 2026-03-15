// Supabase Configuration for Instructor Portal - Only load once
if (typeof window.InstructorConfigLoaded === 'undefined') {
    window.InstructorConfigLoaded = true;
    
    const SUPABASE_URL = 'https://vaagvairvwmgyzsmymhs.supabase.co'
    const SUPABASE_ANON_KEY = 'sb_publishable_IPcFlKw8LEGnk2NYg5qrsw_Rq8yIhR1'

    // Check if Supabase library is loaded
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase library not loaded! Make sure the CDN script is included before this file.');
        throw new Error('Supabase library not loaded');
    }

    // Initialize Supabase client and make it global
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

// Make supabase accessible (use var to allow redeclaration)
var supabase = window.supabaseClient

// =====================================================
// INSTRUCTOR AUTHENTICATION
// =====================================================
var InstructorAuth = {
    // Sign in
    async signIn(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            })
            
            if (error) throw error
            
            // Verify user is an instructor
            const { data: instructorData, error: instructorError } = await supabase
                .from('instructors')
                .select('*')
                .eq('id', data.user.id)
                .eq('is_active', true)
                .single()
            
            if (instructorError || !instructorData) {
                await supabase.auth.signOut()
                throw new Error('Access denied. You are not registered as an instructor.')
            }
            
            // Update last login
            await supabase
                .from('instructors')
                .update({ last_login: new Date().toISOString() })
                .eq('id', data.user.id)
            
            return { success: true, data, instructor: instructorData }
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
    },

    // Get instructor profile
    async getInstructorProfile() {
        try {
            const user = await this.getCurrentUser()
            if (!user) return null

            const { data, error } = await supabase
                .from('instructors')
                .select('*')
                .eq('id', user.id)
                .single()
            
            if (error) throw error
            return data
        } catch (error) {
            console.error('Get instructor profile error:', error)
            return null
        }
    }
}

// =====================================================
// CLASS MANAGEMENT
// =====================================================
const ClassManagement = {
    // Get all classes for instructor
    async getInstructorClasses(instructorId, filters = {}) {
        try {
            let query = supabase
                .from('scheduled_classes')
                .select(`
                    *,
                    instructor:instructors(first_name, last_name, email),
                    enrollments:class_enrollments(count)
                `)
                .eq('instructor_id', instructorId)
                .order('scheduled_date', { ascending: true })
                .order('start_time', { ascending: true })
            
            // Apply filters
            if (filters.status) {
                query = query.eq('status', filters.status)
            }
            if (filters.startDate) {
                query = query.gte('scheduled_date', filters.startDate)
            }
            if (filters.endDate) {
                query = query.lte('scheduled_date', filters.endDate)
            }
            
            const { data, error } = await query
            if (error) throw error
            
            return { success: true, data }
        } catch (error) {
            console.error('Get classes error:', error)
            return { success: false, error: error.message }
        }
    },

    // Create new class
    async createClass(instructorId, classData) {
        try {
            const { data, error } = await supabase
                .from('scheduled_classes')
                .insert({
                    instructor_id: instructorId,
                    ...classData
                })
                .select()
                .single()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Create class error:', error)
            return { success: false, error: error.message }
        }
    },

    // Update class
    async updateClass(classId, updates) {
        try {
            const { data, error } = await supabase
                .from('scheduled_classes')
                .update(updates)
                .eq('id', classId)
                .select()
                .single()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Update class error:', error)
            return { success: false, error: error.message }
        }
    },

    // Delete class
    async deleteClass(classId) {
        try {
            const { error } = await supabase
                .from('scheduled_classes')
                .delete()
                .eq('id', classId)
            
            if (error) throw error
            return { success: true }
        } catch (error) {
            console.error('Delete class error:', error)
            return { success: false, error: error.message }
        }
    },

    // Get class details with enrollments
    async getClassDetails(classId) {
        try {
            const { data, error } = await supabase
                .from('scheduled_classes')
                .select(`
                    *,
                    instructor:instructors(first_name, last_name, email),
                    enrollments:class_enrollments(
                        *,
                        student:students(id, email, first_name, last_name)
                    )
                `)
                .eq('id', classId)
                .single()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Get class details error:', error)
            return { success: false, error: error.message }
        }
    }
}

// =====================================================
// ENROLLMENT MANAGEMENT
// =====================================================
const EnrollmentManagement = {
    // Add student to class
    async enrollStudent(classId, studentId) {
        try {
            const { data, error } = await supabase
                .from('class_enrollments')
                .insert({
                    class_id: classId,
                    student_id: studentId,
                    enrollment_status: 'enrolled'
                })
                .select()
                .single()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Enroll student error:', error)
            return { success: false, error: error.message }
        }
    },

    // Remove student from class
    async removeStudent(classId, studentId) {
        try {
            const { error } = await supabase
                .from('class_enrollments')
                .delete()
                .eq('class_id', classId)
                .eq('student_id', studentId)
            
            if (error) throw error
            return { success: true }
        } catch (error) {
            console.error('Remove student error:', error)
            return { success: false, error: error.message }
        }
    },

    // Update enrollment status
    async updateEnrollmentStatus(classId, studentId, status) {
        try {
            const { data, error } = await supabase
                .from('class_enrollments')
                .update({ enrollment_status: status })
                .eq('class_id', classId)
                .eq('student_id', studentId)
                .select()
                .single()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Update enrollment error:', error)
            return { success: false, error: error.message }
        }
    },

    // Get all enrolled students for a class
    async getClassStudents(classId) {
        try {
            const { data, error } = await supabase
                .from('class_enrollments')
                .select(`
                    *,
                    student:students(
                        id, 
                        email, 
                        first_name, 
                        last_name,
                        created_at
                    )
                `)
                .eq('class_id', classId)
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Get class students error:', error)
            return { success: false, error: error.message }
        }
    }
}

// =====================================================
// ATTENDANCE MANAGEMENT
// =====================================================
const AttendanceManagement = {
    // Mark attendance
    async markAttendance(classId, studentId, instructorId, status, notes = null) {
        try {
            const attendanceData = {
                class_id: classId,
                student_id: studentId,
                attendance_status: status,
                marked_by: instructorId,
                notes: notes
            }

            // Set check-in time for present/late
            if (status === 'present' || status === 'late') {
                attendanceData.check_in_time = new Date().toISOString()
            }

            const { data, error } = await supabase
                .from('class_attendance')
                .upsert(attendanceData, {
                    onConflict: 'class_id,student_id'
                })
                .select()
                .single()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Mark attendance error:', error)
            return { success: false, error: error.message }
        }
    },

    // Get attendance for class
    async getClassAttendance(classId) {
        try {
            const { data, error } = await supabase
                .from('class_attendance')
                .select(`
                    *,
                    student:students(id, email, first_name, last_name),
                    marked_by_instructor:instructors(first_name, last_name)
                `)
                .eq('class_id', classId)
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Get attendance error:', error)
            return { success: false, error: error.message }
        }
    },

    // Get student attendance history
    async getStudentAttendance(studentId) {
        try {
            const { data, error } = await supabase
                .from('class_attendance')
                .select(`
                    *,
                    class:scheduled_classes(class_name, scheduled_date, start_time)
                `)
                .eq('student_id', studentId)
                .order('class.scheduled_date', { ascending: false })
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Get student attendance error:', error)
            return { success: false, error: error.message }
        }
    }
}

// =====================================================
// CERTIFICATE MANAGEMENT
// =====================================================
const CertificateManagement = {
    // Check if student meets certificate requirements
    async checkCertificateEligibility(studentId, certificateType = 'unarmed_guard') {
        try {
            // Get prerequisites
            const { data: prereqs, error: prereqError } = await supabase
                .from('certificate_prerequisites')
                .select('*')
                .eq('certificate_type', certificateType)
                .eq('is_required', true)
            
            if (prereqError) throw prereqError

            const results = {
                eligible: true,
                completedRequirements: [],
                missingRequirements: []
            }

            for (const prereq of prereqs) {
                let met = false

                if (prereq.prerequisite_type === 'module') {
                    // Check module completion
                    const { data: progress } = await supabase
                        .from('student_module_progress')
                        .select('status')
                        .eq('student_id', studentId)
                        .eq('module_id', prereq.prerequisite_value)
                        .eq('status', 'completed')
                        .single()
                    
                    met = !!progress
                }
                else if (prereq.prerequisite_type === 'assessment') {
                    // Check assessment scores
                    const { data: results } = await supabase
                        .from('assessment_results')
                        .select('score, passed')
                        .eq('student_id', studentId)
                        .eq('passed', true)
                        .gte('score', 80)
                    
                    met = results && results.length > 0
                }
                else if (prereq.prerequisite_type === 'attendance') {
                    // Check attendance count
                    const requiredCount = parseInt(prereq.prerequisite_value)
                    const { data: attendance } = await supabase
                        .from('class_attendance')
                        .select('id')
                        .eq('student_id', studentId)
                        .eq('attendance_status', 'present')
                    
                    met = attendance && attendance.length >= requiredCount
                }

                if (met) {
                    results.completedRequirements.push(prereq)
                } else {
                    results.missingRequirements.push(prereq)
                    results.eligible = false
                }
            }

            return { success: true, data: results }
        } catch (error) {
            console.error('Check eligibility error:', error)
            return { success: false, error: error.message }
        }
    },

    // Issue certificate
    async issueCertificate(studentId, instructorId, certificateData) {
        try {
            // Generate certificate number
            const { data: certNumber } = await supabase
                .rpc('generate_certificate_number', { cert_type: certificateData.certificate_type })
            
            const certificate = {
                certificate_number: certNumber,
                student_id: studentId,
                issued_by: instructorId,
                certificate_type: certificateData.certificate_type,
                certificate_name: certificateData.certificate_name,
                state_issued: certificateData.state_issued || null,
                issue_date: new Date().toISOString().split('T')[0],
                expiration_date: certificateData.expiration_date || null,
                verification_code: this.generateVerificationCode(),
                notes: certificateData.notes || null
            }

            const { data, error } = await supabase
                .from('certificates')
                .insert(certificate)
                .select()
                .single()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Issue certificate error:', error)
            return { success: false, error: error.message }
        }
    },

    // Generate verification code
    generateVerificationCode() {
        return 'EA-' + Math.random().toString(36).substr(2, 9).toUpperCase()
    },

    // Get student certificates
    async getStudentCertificates(studentId) {
        try {
            const { data, error } = await supabase
                .from('certificates')
                .select(`
                    *,
                    issued_by_instructor:instructors(first_name, last_name)
                `)
                .eq('student_id', studentId)
                .order('issue_date', { ascending: false })
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Get certificates error:', error)
            return { success: false, error: error.message }
        }
    },

    // Revoke certificate
    async revokeCertificate(certificateId, instructorId, reason) {
        try {
            const { data, error } = await supabase
                .from('certificates')
                .update({
                    status: 'revoked',
                    revoked_at: new Date().toISOString(),
                    revoked_by: instructorId,
                    revocation_reason: reason
                })
                .eq('id', certificateId)
                .select()
                .single()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Revoke certificate error:', error)
            return { success: false, error: error.message }
        }
    }
}

// =====================================================
// STUDENT DATA
// =====================================================
const StudentData = {
    // Get all students
    async getAllStudents(filters = {}) {
        try {
            let query = supabase
                .from('students')
                .select(`
                    *,
                    profile:student_profiles(*),
                    progress:student_module_progress(count),
                    certificates:certificates(count)
                `)
                .order('created_at', { ascending: false })
            
            // Apply filters
            if (filters.search) {
                query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
            }
            
            const { data, error } = await query
            if (error) throw error
            
            return { success: true, data }
        } catch (error) {
            console.error('Get students error:', error)
            return { success: false, error: error.message }
        }
    },

    // Get student details
    async getStudentDetails(studentId) {
        try {
            const { data, error } = await supabase
                .from('students')
                .select(`
                    *,
                    profile:student_profiles(*),
                    progress:student_module_progress(
                        *,
                        module:training_modules(module_name, module_code)
                    ),
                    assessments:assessment_results(
                        *,
                        assessment:assessments(assessment_name)
                    ),
                    certificates:certificates(*),
                    attendance:class_attendance(
                        *,
                        class:scheduled_classes(class_name, scheduled_date)
                    )
                `)
                .eq('id', studentId)
                .single()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Get student details error:', error)
            return { success: false, error: error.message }
        }
    }
}

// =====================================================
// INSTRUCTOR NOTES
// =====================================================
const InstructorNotes = {
    // Add note
    async addNote(instructorId, studentId, noteData) {
        try {
            const { data, error } = await supabase
                .from('instructor_notes')
                .insert({
                    instructor_id: instructorId,
                    student_id: studentId,
                    ...noteData
                })
                .select()
                .single()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Add note error:', error)
            return { success: false, error: error.message }
        }
    },

    // Get student notes
    async getStudentNotes(studentId) {
        try {
            const { data, error } = await supabase
                .from('instructor_notes')
                .select(`
                    *,
                    instructor:instructors(first_name, last_name),
                    class:scheduled_classes(class_name)
                `)
                .eq('student_id', studentId)
                .order('created_at', { ascending: false })
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Get notes error:', error)
            return { success: false, error: error.message }
        }
    },

    // Update note
    async updateNote(noteId, updates) {
        try {
            const { data, error } = await supabase
                .from('instructor_notes')
                .update(updates)
                .eq('id', noteId)
                .select()
                .single()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Update note error:', error)
            return { success: false, error: error.message }
        }
    },

    // Delete note
    async deleteNote(noteId) {
        try {
            const { error } = await supabase
                .from('instructor_notes')
                .delete()
                .eq('id', noteId)
            
            if (error) throw error
            return { success: true }
        } catch (error) {
            console.error('Delete note error:', error)
            return { success: false, error: error.message }
        }
    }
}

// Export for use in other files
window.InstructorAuth = InstructorAuth
window.ClassManagement = ClassManagement
window.EnrollmentManagement = EnrollmentManagement
window.AttendanceManagement = AttendanceManagement
window.CertificateManagement = CertificateManagement
window.StudentData = StudentData
window.InstructorNotes = InstructorNotes
