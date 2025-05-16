import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server'; // Using server client
import { MemeTemplate } from '@/lib/supabase/types';
// OpenAI import might not be strictly needed here anymore if not generating embeddings
// import { OpenAI } from 'openai'; 
import { z } from 'zod';

// Define Zod schema for request body validation
const MemeSelectionSchema = z.object({
  // Prompt is still received as AIMemeSelector sends it, but not used for vector search here.
  // It will be used by AIMemeSelector for the subsequent AI captioning step.
  prompt: z.string().min(1, { message: "Prompt cannot be empty (even if not used for vector search here)" }),
  isGreenscreenMode: z.boolean().optional(),
  audience: z.string().optional(), 
});

export async function POST(req: NextRequest) {
  const supabase = createClient();

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validationResult = MemeSelectionSchema.safeParse(body);

  if (!validationResult.success) {
    return NextResponse.json({ error: 'Invalid request parameters', details: validationResult.error.flatten() }, { status: 400 });
  }

  const { isGreenscreenMode, prompt } = validationResult.data; // Keep prompt for logging context
  const matchCount = 5; 

  console.log(`[API /meme-selection] Request for prompt: "${prompt}", Greenscreen: ${isGreenscreenMode}, Fetching ${matchCount} random templates.`);

  try {
    const { data: templates, error: rpcError } = await supabase
      .rpc('get_random_reviewed_templates_for_ai_selector', {
        match_count: matchCount,
        is_greenscreen_filter: isGreenscreenMode ?? null, 
      });

    if (rpcError) {
      console.error('Supabase RPC error in meme-selection (random fetch):', rpcError);
      return NextResponse.json({ error: 'Failed to fetch random templates via RPC', details: rpcError.message }, { status: 500 });
    }

    if (!templates) {
        console.log('[API /meme-selection] RPC returned null, sending empty templates array.');
        return NextResponse.json({ templates: [] });
    }
    
    console.log(`[API /meme-selection] Successfully fetched ${templates.length} random templates:`, templates.map((t: MemeTemplate) => ({ id: t.id, name: t.name })));
    return NextResponse.json({ templates });

  } catch (error: any) {
    console.error('Error in POST /api/meme-selection (random fetch):', error);
    return NextResponse.json(
      { error: 'Failed to process meme selection', details: error.message },
      { status: 500 }
    );
  }
} 