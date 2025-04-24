import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/route';
import { PersonaCreateSchema } from '@/lib/schemas';

// Optional: Consider Edge Runtime
// export const runtime = 'edge';

// GET /api/personas - Fetch all personas for the authenticated user
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;

  try {
    const { data, error } = await supabase
      .from('personas')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(`[User: ${userId}] Error fetching personas:`, error);
      return NextResponse.json({ error: 'Failed to fetch personas', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] }); // Ensure data is always an array

  } catch (e: any) {
    console.error(`[User: ${userId}] Unexpected error fetching personas:`, e);
    return NextResponse.json({ error: 'An unexpected error occurred', details: e.message }, { status: 500 });
  }
}

// POST /api/personas - Create a new persona for the authenticated user
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;

  try {
    const reqBody = await request.json();

    // Validate input body
    const validationResult = PersonaCreateSchema.safeParse(reqBody);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description } = validationResult.data;

    const { data: newPersona, error: insertError } = await supabase
      .from('personas')
      .insert({ 
        user_id: userId, 
        name: name, // Already trimmed by Zod
        description: description // Already trimmed by Zod
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[User: ${userId}] Error creating persona:`, insertError);
      // Handle specific errors like unique constraint violation (duplicate name)
      if (insertError.code === '23505') { // PostgreSQL unique violation code
         return NextResponse.json({ error: 'A persona with this name already exists.' }, { status: 409 }); // 409 Conflict
      }
      return NextResponse.json({ error: 'Failed to create persona', details: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ data: newPersona }, { status: 201 }); // 201 Created

  } catch (e: any) {
    console.error(`[User: ${userId}] Unexpected error creating persona:`, e);
    return NextResponse.json({ error: 'An unexpected error occurred', details: e.message }, { status: 500 });
  }
} 