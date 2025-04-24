import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/route'; // Route Handler client
import { CaptionRuleCreateSchema } from '@/lib/schemas';
import { z } from 'zod';

// GET: Fetch all caption rule sets for the authenticated user
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn('GET /api/caption-rules: Unauthorized access attempt.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('caption_generation_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching caption rules:', error);
      throw error; // Rethrow Supabase error
    }

    return NextResponse.json({ data: data || [] });

  } catch (err: any) {
    console.error('GET /api/caption-rules error:', err);
    // Differentiate between Supabase errors and others if needed
    const errorMessage = err.message || 'An unexpected error occurred';
    const statusCode = err.code // Use Supabase error code if available
      ? (parseInt(err.code) || 500) 
      : 500;
    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}

// POST: Create a new caption rule set for the authenticated user
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn('POST /api/caption-rules: Unauthorized access attempt.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const json = await request.json();
    const validatedData = CaptionRuleCreateSchema.parse(json);

    const { data, error: insertError } = await supabase
      .from('caption_generation_rules')
      .insert({ 
        user_id: user.id, 
        name: validatedData.name, 
        rules_text: validatedData.rules_text 
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting caption rule:', insertError);
      // Handle potential unique constraint violation (duplicate name)
      if (insertError.code === '23505') { // PostgreSQL unique violation code
        return NextResponse.json({ error: 'A rule set with this name already exists.' }, { status: 409 }); // Conflict
      }
      throw insertError; // Rethrow other Supabase errors
    }

    return NextResponse.json({ data }, { status: 201 }); // 201 Created

  } catch (err: any) {
    console.error('POST /api/caption-rules error:', err);
    if (err instanceof z.ZodError) {
      // Format Zod errors for better client-side handling
      return NextResponse.json({ error: 'Invalid input', details: err.flatten().fieldErrors }, { status: 400 });
    } 
    // Handle Supabase or other errors
    const errorMessage = err.message || 'An unexpected error occurred';
    const statusCode = err.code ? (parseInt(err.code) || 500) : 500;
    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
} 