import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/route'; // Use route handler client
import { OpenAI } from 'openai'; // Import the class
import { MemeTemplate } from '@/lib/supabase/types'; // Import your type

// Input validation schema
const TemplateSelectSchema = z.object({
  prompt: z.string().optional(),
  audience: z.string().optional(), // Currently unused in logic, but good to validate
  count: z.number().int().positive().max(10).default(3), // Default to 3, max 10
  isGreenscreenMode: z.boolean().optional(),
  persona_id: z.string().uuid().optional().nullable(), // <<< Added persona_id
});

// Optional: Consider Edge Runtime for performance
// export const runtime = 'edge';

export async function POST(request: Request) {
  const supabase = createClient(); // Call helper without arguments

  // --- Authentication Check --- 
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn('Unauthorized API access attempt to /api/templates/select');
    // TODO: Log auth failure details (IP, user-agent)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id; // Use userId if needed later for filtering based on user
  // --------------------------

  try {
    const reqBody = await request.json();

    // Validate input
    const validationResult = TemplateSelectSchema.safeParse(reqBody);
    if (!validationResult.success) {
      console.error('Validation Error:', validationResult.error.errors);
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { prompt, count, isGreenscreenMode, persona_id } = validationResult.data;

    let templates: MemeTemplate[] | null = null;
    let error: any = null;
    let rpcParams: any;

    if (prompt && prompt.trim().length > 0) {
      // --- Vector Search Logic ---
      console.log(`[User: ${userId}] Performing vector search for prompt: "${prompt}", Persona: ${persona_id || 'None'}`);
      try {
        // 1. Instantiate OpenAI client (only when needed)
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        // 2. Generate embedding for the prompt
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small', // Or your preferred embedding model
          input: prompt,
        });
        const embedding = embeddingResponse.data[0].embedding;

        // 2. Call Supabase RPC function 'match_meme_templates'
        rpcParams = {
          query_embedding: embedding,
          match_threshold: 0.7, // Adjust threshold as needed
          match_count: count,
          filter_greenscreen: isGreenscreenMode,
          user_id_param: userId,          // Pass user ID
          persona_id_param: persona_id    // Pass persona ID (can be null)
        };

        const { data: matchedData, error: matchError } = await supabase.rpc(
          'match_meme_templates',
          rpcParams
        );

        if (matchError) throw matchError;
        templates = matchedData;
        console.log(`[User: ${userId}] Found ${templates?.length ?? 0} templates via vector search.`);

      } catch (e) {
        console.error(`[User: ${userId}] Error during vector search:`, e);
        error = e;
      }
    } else {
      // --- Random Selection Logic ---
      console.log(`[User: ${userId}] Performing random template selection. Persona: ${persona_id || 'None'}`);
      try {
        // Ensure all parameters expected by the SQL function are included here
        // and match the order suggested by the error hint.
        rpcParams = {
          filter_greenscreen: isGreenscreenMode ?? null, // Default to null if undefined
          limit_count: count, 
          user_id_param: userId,         
          persona_id_param: persona_id   
        };
        
        const { data: randomData, error: randomError } = await supabase.rpc(
          'get_random_meme_templates',
          rpcParams
        );

        if (randomError) throw randomError;
        templates = randomData;
        console.log(`[User: ${userId}] Found ${templates?.length ?? 0} random templates.`);

      } catch (e) {
        console.error(`[User: ${userId}] Error during random selection:`, e);
        error = e;
      }
    }

    // Handle potential errors from Supabase calls
    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch templates from database', details: error.message },
        { status: 500 }
      );
    }

    // Handle case where no templates are found
    if (!templates || templates.length === 0) {
      return NextResponse.json(
        // Return empty array instead of 404, as finding nothing isn't strictly an error
        { templates: [] }, 
        { status: 200 }
      );
    }

    // Return the selected templates
    return NextResponse.json({ templates });

  } catch (e: any) {
    // Catch errors from request parsing or unexpected issues
    console.error(`[User: ${userId}] Unexpected Error in /api/templates/select:`, e);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: e.message },
      { status: 500 }
    );
  }
} 