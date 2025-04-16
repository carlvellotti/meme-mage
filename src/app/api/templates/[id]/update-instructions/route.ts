import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { URL } from 'url';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { instructions: newInstructions } = await request.json(); // Rename for clarity
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }
    if (typeof newInstructions !== 'string') {
      return NextResponse.json({ error: 'Instructions must be a string' }, { status: 400 });
    }
    
    console.log(`[API Update Instructions] Updating template ${id} with new instructions...`);

    // 1. Fetch the current template name
    const { data: templateData, error: fetchError } = await supabaseAdmin
      .from('meme_templates')
      .select('name')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error(`[API Update Instructions] Supabase error fetching template name for ${id}:`, fetchError);
      throw new Error(`Failed to fetch template data: ${fetchError.message}`);
    }
    if (!templateData) {
      return NextResponse.json({ error: `Template with ID ${id} not found` }, { status: 404 });
    }
    const templateName = templateData.name;

    // 2. Generate new embedding
    const textForEmbedding = `${templateName}. ${newInstructions}`.trim();
    if (!textForEmbedding) {
      // Should not happen if name exists and instructions are provided, but good practice
      throw new Error('Cannot generate embedding from empty name or instructions.');
    }
    
    console.log(`[API Update Instructions] Generating new embedding for template ${id}...`);
    
    // Assuming embedding generation happens via another API route or function
    // For now, let's simulate calling the internal embedding API
    // NOTE: In a real scenario, might directly call the embedding service (e.g., OpenAI) 
    //       or have a shared lib function to avoid internal HTTP calls.
    const origin = new URL(request.url).origin;
    const embeddingResponse = await fetch(`${origin}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Pass necessary auth if required between internal APIs
      body: JSON.stringify({ text: textForEmbedding })
    });

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error(`[API Update Instructions] Embedding API error for template ${id}:`, errorText);
      throw new Error(`Failed to generate embedding: ${errorText || 'Embedding API request failed'}`);
    }

    const { embedding } = await embeddingResponse.json();
    console.log(`[API Update Instructions] New embedding received for template ${id}, length:`, embedding?.length);
    if (!embedding || embedding.length === 0) {
      throw new Error('Received invalid or empty embedding from API');
    }

    // 3. Update both instructions and embedding in the database
    console.log(`[API Update Instructions] Updating Supabase for template ${id}...`);
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('meme_templates')
      .update({ 
        instructions: newInstructions, 
        embedding: embedding 
      })
      .eq('id', id)
      .select()
      .single();
      
    if (updateError) {
      console.error(`[API Update Instructions] Supabase error updating template ${id}:`, updateError);
      throw updateError;
    }
    
    console.log(`[API Update Instructions] Successfully updated template ${id}.`);
    return NextResponse.json({ success: true, data: updateData });
    
  } catch (error) {
    console.error('[API Update Instructions] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update instructions and embedding' },
      { status: 500 }
    );
  }
} 