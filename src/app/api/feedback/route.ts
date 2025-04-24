import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/route';
import { FeedbackCreateSchema } from '@/lib/schemas';

// Optional: Consider Edge Runtime
// export const runtime = 'edge';

// POST /api/feedback - Create or update feedback for a template/persona
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
    const validationResult = FeedbackCreateSchema.safeParse(reqBody);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { template_id, persona_id, status } = validationResult.data;

    // Perform an upsert operation
    // If a row with the unique constraint (user_id, persona_id, template_id) exists, update its status.
    // Otherwise, insert a new row.
    const { data: feedbackData, error: upsertError } = await supabase
      .from('meme_feedback')
      .upsert({
        user_id: userId,
        persona_id: persona_id,
        template_id: template_id,
        status: status,
        // created_at and updated_at are handled by DB defaults/triggers
      }, {
        onConflict: 'user_id, persona_id, template_id', // Specify the conflict target
      })
      .select()
      .single();

    if (upsertError) {
      console.error(`[User: ${userId}] Error upserting feedback:`, upsertError);
      return NextResponse.json({ error: 'Failed to save feedback', details: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ data: feedbackData }, { status: 200 }); // Return 200 OK for upsert

  } catch (e: any) {
    console.error(`[User: ${userId}] Unexpected error saving feedback:`, e);
    return NextResponse.json({ error: 'An unexpected error occurred', details: e.message }, { status: 500 });
  }
} 