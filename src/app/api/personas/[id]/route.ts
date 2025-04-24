import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/route';
import { PersonaUpdateSchema } from '@/lib/schemas';
import { z } from 'zod';

// Optional: Consider Edge Runtime
// export const runtime = 'edge';

const UUIDSchema = z.string().uuid({ message: "Invalid Persona ID format" });

// PUT /api/personas/[id] - Update a specific persona
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;
  const personaId = params.id;

  // Validate the ID from the URL
  const idValidation = UUIDSchema.safeParse(personaId);
  if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid Persona ID in URL', details: idValidation.error.flatten() },
        { status: 400 }
      );
  }

  try {
    const reqBody = await request.json();

    // Validate input body
    const validationResult = PersonaUpdateSchema.safeParse(reqBody);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description } = validationResult.data;

    const { data: updatedPersona, error: updateError } = await supabase
      .from('personas')
      .update({ 
        name: name,
        description: description
        // updated_at is handled by the trigger
      })
      .eq('id', personaId)
      .eq('user_id', userId) // Ensure user owns the persona
      .select()
      .single();

    if (updateError) {
      console.error(`[User: ${userId}] Error updating persona ${personaId}:`, updateError);
       // Handle specific errors like unique constraint violation (duplicate name)
      if (updateError.code === '23505') { 
         return NextResponse.json({ error: 'A persona with this name already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to update persona', details: updateError.message }, { status: 500 });
    }
    
    // If data is null after update, it means the persona wasn't found or didn't belong to the user
    if (!updatedPersona) {
       return NextResponse.json({ error: 'Persona not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ data: updatedPersona });

  } catch (e: any) {
    console.error(`[User: ${userId}] Unexpected error updating persona ${personaId}:`, e);
    return NextResponse.json({ error: 'An unexpected error occurred', details: e.message }, { status: 500 });
  }
}

// DELETE /api/personas/[id] - Delete a specific persona
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;
  const personaId = params.id;

  // Validate the ID from the URL
  const idValidation = UUIDSchema.safeParse(personaId);
  if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid Persona ID in URL', details: idValidation.error.flatten() },
        { status: 400 }
      );
  }

  try {
    const { error: deleteError, count } = await supabase
      .from('personas')
      .delete({ count: 'exact' }) // Request count of deleted rows
      .eq('id', personaId)
      .eq('user_id', userId); // Ensure user owns the persona

    if (deleteError) {
      console.error(`[User: ${userId}] Error deleting persona ${personaId}:`, deleteError);
      return NextResponse.json({ error: 'Failed to delete persona', details: deleteError.message }, { status: 500 });
    }

    // Check if any row was actually deleted
    if (count === 0) {
      return NextResponse.json({ error: 'Persona not found or access denied' }, { status: 404 });
    }
    
    // Successfully deleted
    return NextResponse.json({ data: { success: true } }, { status: 200 }); // Can also use 204 No Content, but returning JSON is consistent

  } catch (e: any) {
    console.error(`[User: ${userId}] Unexpected error deleting persona ${personaId}:`, e);
    return NextResponse.json({ error: 'An unexpected error occurred', details: e.message }, { status: 500 });
  }
} 