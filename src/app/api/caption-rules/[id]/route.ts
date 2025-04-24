import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/route';
import { CaptionRuleUpdateSchema } from '@/lib/schemas';
import { z } from 'zod';

interface RouteParams {
  params: { id: string };
}

// PUT: Update an existing caption rule set
export async function PUT(request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn(`PUT /api/caption-rules/${params.id}: Unauthorized access attempt.`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate UUID format for id
  if (!params.id || !z.string().uuid().safeParse(params.id).success) {
     return NextResponse.json({ error: 'Invalid rule set ID format.' }, { status: 400 });
  }

  try {
    const json = await request.json();
    const validatedData = CaptionRuleUpdateSchema.parse(json);

    // Check if there's anything to update
    if (Object.keys(validatedData).length === 0) {
       return NextResponse.json({ error: 'No fields provided for update.' }, { status: 400 });
    }

    const { data, error: updateError } = await supabase
      .from('caption_generation_rules')
      .update(validatedData) // Only updates fields present in validatedData
      .eq('id', params.id)
      .eq('user_id', user.id) // Ensure user owns the record
      .select()
      .single();

    if (updateError) {
      console.error(`Error updating caption rule ${params.id}:`, updateError);
      // Handle potential unique constraint violation (duplicate name)
      if (updateError.code === '23505') { // PostgreSQL unique violation code
        return NextResponse.json({ error: 'A rule set with this name already exists.' }, { status: 409 }); // Conflict
      }
      throw updateError; // Rethrow other errors
    }

    if (!data) {
        // This means the ID didn't exist or the user didn't own it
        return NextResponse.json({ error: 'Rule set not found or access denied.' }, { status: 404 });
    }

    return NextResponse.json({ data });

  } catch (err: any) {
    console.error(`PUT /api/caption-rules/${params.id} error:`, err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.flatten().fieldErrors }, { status: 400 });
    }
    const errorMessage = err.message || 'An unexpected error occurred';
    const statusCode = err.code ? (parseInt(err.code) || 500) : 500;
    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}

// DELETE: Delete a caption rule set
export async function DELETE(request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
     console.warn(`DELETE /api/caption-rules/${params.id}: Unauthorized access attempt.`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate UUID format for id
  if (!params.id || !z.string().uuid().safeParse(params.id).success) {
     return NextResponse.json({ error: 'Invalid rule set ID format.' }, { status: 400 });
  }

  try {
    // We need to check if the row exists *and* belongs to the user before deleting
    // Or just attempt the delete with the user_id filter
    const { error: deleteError, count } = await supabase
      .from('caption_generation_rules')
      .delete({ count: 'exact' }) // Request count of deleted rows
      .eq('id', params.id)
      .eq('user_id', user.id); // Crucial: only delete if user owns it

    if (deleteError) {
      console.error(`Error deleting caption rule ${params.id}:`, deleteError);
      throw deleteError;
    }

    if (count === 0) {
      // If count is 0, the record either didn't exist or didn't belong to the user
      return NextResponse.json({ error: 'Rule set not found or access denied.' }, { status: 404 });
    }
    
    // Successfully deleted
    return NextResponse.json({ data: { success: true } }, { status: 200 }); 
    // Or return 204 No Content: return new Response(null, { status: 204 });

  } catch (err: any) {
    console.error(`DELETE /api/caption-rules/${params.id} error:`, err);
    const errorMessage = err.message || 'An unexpected error occurred';
    const statusCode = err.code ? (parseInt(err.code) || 500) : 500;
    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
} 