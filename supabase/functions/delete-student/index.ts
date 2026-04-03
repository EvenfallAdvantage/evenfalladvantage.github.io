// Evenfall Advantage - Delete Student Function
// Deletes a student from both the database and Supabase Auth
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

console.log("Delete Student Function Started")

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) })
  }

  try {
    // Verify the caller is an administrator
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) throw new Error('Unauthorized')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: adminRecord } = await supabaseAdmin
      .from('administrators').select('id').eq('user_id', caller.id).single()

    if (!adminRecord) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin access required' }),
        { headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    const { studentId } = await req.json()
    
    if (!studentId) {
      throw new Error('Student ID is required')
    }
    
    console.log(`Deleting student: ${studentId}`)
    
    // Delete from student_profiles first (foreign key constraint)
    const { error: profileError } = await supabaseAdmin
      .from('student_profiles')
      .delete()
      .eq('student_id', studentId)
    
    if (profileError) {
      console.error('Error deleting student profile:', profileError)
      // Continue even if profile doesn't exist
    }
    
    // Delete from students table
    const { error: studentError } = await supabaseAdmin
      .from('students')
      .delete()
      .eq('id', studentId)
    
    if (studentError) {
      console.error('Error deleting student record:', studentError)
      throw studentError
    }
    
    // Delete from Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(studentId)
    
    if (authError) {
      console.error('Error deleting auth user:', authError)
      throw authError
    }
    
    console.log('Student deleted successfully')
    
    return new Response(
      JSON.stringify({ success: true, message: 'Student deleted successfully' }),
      { 
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
