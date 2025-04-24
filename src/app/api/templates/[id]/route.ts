import { createClient } from '@/lib/supabase/route';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateEmbedding } from '@/lib/utils/embeddings';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('meme_templates')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch template' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

// PATCH /api/templates/[id] - Update template (name, instructions) or approve (reviewed=true)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const id = params.id;
  let body;

  // Check auth first
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.warn('Unauthorized PATCH request to /api/templates/[id]');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!id) {
    return NextResponse.json({ error: 'Missing template ID' }, { status: 400 });
  }

  const { name, instructions, reviewed } = body;

  // Basic validation
  if (name !== undefined && typeof name !== 'string') {
     return NextResponse.json({ error: 'Invalid name format' }, { status: 400 });
  }
  if (instructions !== undefined && typeof instructions !== 'string') {
     return NextResponse.json({ error: 'Invalid instructions format' }, { status: 400 });
  }
   if (reviewed !== undefined && typeof reviewed !== 'boolean') {
     return NextResponse.json({ error: 'Invalid reviewed format' }, { status: 400 });
  }

  const updateData: { [key: string]: any } = {};
  let reEmbeddingError: string | null = null;

  if (name !== undefined) {
    updateData.name = name;
  }
  if (reviewed !== undefined) {
    updateData.reviewed = reviewed; // Should typically only be set to true via this endpoint
  }

  // Handle instructions update and re-vectorization
  if (instructions !== undefined) {
    updateData.instructions = instructions;
    try {
      console.log(`[PATCH /api/templates/${id}] Re-generating embedding for updated instructions...`);
      const embeddingVector = await generateEmbedding(instructions);
      updateData.embedding = embeddingVector;
      console.log(`[PATCH /api/templates/${id}] New embedding generated.`);
    } catch (error: any) {
      console.error(`[PATCH /api/templates/${id}] Embedding generation failed:`, error);
      reEmbeddingError = error.message || 'Failed to generate embedding for updated instructions.';
      // Decide how to handle: Fail the whole request or update without embedding?
      // For now, let's fail the request if embedding fails.
      return NextResponse.json({ error: `Failed to update embedding: ${reEmbeddingError}` }, { status: 500 });
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields provided for update' }, { status: 400 });
  }

  console.log(`[PATCH /api/templates/${id}] Updating template with data:`, updateData);

  try {
    const { data, error } = await supabaseAdmin
      .from('meme_templates')
      .update(updateData)
      .eq('id', id)
      .select() // Optionally return the updated record
      .single(); // Assuming ID is unique

    if (error) {
      console.error(`[PATCH /api/templates/${id}] Supabase update error:`, error);
      // Check for specific errors, e.g., not found
      if (error.code === 'PGRST116') { // PostgREST code for "Matching row not found"
          return NextResponse.json({ error: `Template with ID ${id} not found.` }, { status: 404 });
      }
      throw error; // Throw for general Supabase errors
    }

    console.log(`[PATCH /api/templates/${id}] Update successful.`);
    // Return the updated template object directly
    return NextResponse.json(data, { status: 200 });

  } catch (error: any) {
    console.error(`[PATCH /api/templates/${id}] Error updating template:`, error);
    const message = error?.message || 'Failed to update template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/templates/[id] - Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const id = params.id;

  // Check auth first
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.warn('Unauthorized DELETE request to /api/templates/[id]');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json({ error: 'Missing template ID' }, { status: 400 });
  }

  console.log(`[DELETE /api/templates/${id}] Attempting to delete template...`);

  try {
    const { error } = await supabaseAdmin
      .from('meme_templates')
      .delete()
      .eq('id', id);

    if (error) {
       console.error(`[DELETE /api/templates/${id}] Supabase delete error:`, error);
       throw error; // Let the generic catch handle it
    }

    // Check if any row was actually deleted (optional, Supabase delete doesn't error if 0 rows match)
    // const { count } = await supabaseAdmin.from('meme_templates').select('*', { count: 'exact', head: true }).eq('id', id);
    // if (count === 0) { ... maybe return 404? } -> Delete is often idempotent

    console.log(`[DELETE /api/templates/${id}] Deletion successful (or template didn't exist).`);
    return new NextResponse(null, { status: 204 }); // Standard success response for DELETE

  } catch (error: any) {
    console.error(`[DELETE /api/templates/${id}] Error deleting template:`, error);
    const message = error?.message || 'Failed to delete template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 