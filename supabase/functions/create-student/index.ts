// Evenfall Advantage - Create Student Function
// Creates a student with admin privileges (bypasses email confirmation)
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log("Create Student Function Started")

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, firstName, lastName, phone } = await req.json()
    
    if (!email || !password || !firstName || !lastName) {
      throw new Error('Email, password, first name, and last name are required')
    }
    
    console.log(`Creating student: ${email}`)
    
    // Create Supabase client with service role key (has admin privileges)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    // Create user with admin API (auto-confirmed, no email verification needed)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        user_type: 'student'
      },
      app_metadata: {
        provider: 'email',
        providers: ['email']
      }
    })
    
    if (authError) {
      console.error('Error creating auth user:', authError)
      console.error('Auth error details:', JSON.stringify(authError))
      throw new Error(`Failed to create auth user: ${authError.message}`)
    }
    
    if (!authData.user) {
      throw new Error('User creation failed')
    }
    
    console.log('Auth user created:', authData.user.id)
    
    // Wait a moment for any database triggers to complete
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Check if student record already exists (created by trigger)
    const { data: existingStudent } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('id', authData.user.id)
      .single()
    
    if (!existingStudent) {
      // Create student record if it doesn't exist
      const { error: studentError } = await supabaseAdmin
        .from('students')
        .insert({
          id: authData.user.id,
          email: email,
          first_name: firstName,
          last_name: lastName
        })
      
      if (studentError && studentError.code !== '23505') {
        // If error is not duplicate key, it's a real error
        console.error('Error creating student record:', studentError)
        // Delete the auth user to keep things clean
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        throw studentError
      }
      
      console.log('Student record created')
    } else {
      console.log('Student record already exists (created by trigger)')
    }
    
    // Create student profile
    const { error: profileError } = await supabaseAdmin
      .from('student_profiles')
      .insert({
        student_id: authData.user.id,
        phone: phone || null
      })
    
    if (profileError) {
      console.error('Error creating student profile:', profileError)
      // Continue even if profile creation fails
    }
    
    console.log('Student created successfully')
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: authData.user.id,
        message: 'Student created successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
