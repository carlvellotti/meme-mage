import { type NextRequest, NextResponse } from 'next/server'
// Use the client intended for server-side operations (likely admin privileges)
import { createClient } from '@/lib/supabase/server' 
// import { cookies } from 'next/headers' // Not needed for this server client setup

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // const cookieStore = cookies() // Not needed
  const supabase = createClient() // Call without arguments
  const templateId = params.id

  console.log(`API Route: Attempting to delete unprocessed template with ID: ${templateId}`)

  if (!templateId) {
    console.error('API Route Error: Missing template ID for deletion.')
    return NextResponse.json({ error: 'Missing template ID' }, { status: 400 })
  }

  // --- Authentication and Authorization Check ---
  // IMPORTANT: Even though we use the admin client here, we STILL need
  // to verify the *calling user* has permission. The admin client
  // bypasses RLS but doesn't mean anyone can call this endpoint.
  // You might need a different way to get the user making the request,
  // perhaps via headers, a session check middleware, or a different Supabase auth method.
  
  // Placeholder check - NEEDS PROPER IMPLEMENTATION
  // const callingUserId = request.headers.get('X-User-Id'); // Example: Get user from header
  // if (!callingUserId) { 
  //    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }
  // Add logic here to check if callingUserId has admin role or permission
  // For now, just log a warning
  console.warn("API Route Warning: Proper authentication/authorization for delete endpoint is NOT implemented!")
  // --- End Auth Check ---

  try {
    const { error: deleteError, count } = await supabase
      .from('unprocessed_templates')
      .delete({ count: 'exact' }) // Request count for verification
      .eq('id', templateId)

    if (deleteError) {
      console.error(`API Route Error: Supabase delete error for ID ${templateId}:`, deleteError)
      // Handle specific Supabase errors if needed (e.g., RLS violation)
      return NextResponse.json(
        { error: `Database error: ${deleteError.message}` },
        { status: 500 }
      )
    }

    if (count === 0) {
       console.warn(`API Route Warning: No template found with ID ${templateId} to delete.`)
       // Return 404 Not Found if the record didn't exist
       return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    console.log(`API Route: Successfully deleted template ID: ${templateId}, Count: ${count}`)
    // Return 204 No Content on successful deletion
    return new NextResponse(null, { status: 204 })

  } catch (error) {
    console.error(`API Route Error: Unexpected error deleting template ID ${templateId}:`, error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 