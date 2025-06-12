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
  category: z.string().optional().nullable(), // <-- Added category to schema
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
  const userId = user.id;
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

    const { prompt, count, isGreenscreenMode, persona_id, category } = validationResult.data;

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

        // 3. Call Supabase RPC function 'match_meme_templates'
        // Using parameter names that match the database function signature
        rpcParams = {
          query_embedding: embedding,
          match_threshold: 0.1, // Add threshold parameter
          match_count: count,
          filter_greenscreen: isGreenscreenMode || null,
          user_id_param: userId,
          persona_id_param: persona_id,
        };

        console.log(`[User: ${userId}] RPC params for vector search:`, rpcParams);

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
      // --- Random Selection Logic --- (FIXED: moved outside the if block)
      console.log(`[User: ${userId}] Performing random template selection. Persona: ${persona_id || 'None'}`);
      try {
        // Using parameter names that match the database function signature
        rpcParams = {
          limit_count: count,
          filter_greenscreen: isGreenscreenMode || null,
          user_id_param: userId,
          persona_id_param: persona_id,
        };

        console.log(`[User: ${userId}] RPC params for random selection:`, rpcParams);
        
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
      console.error(`[User: ${userId}] Database error details:`, error);
      return NextResponse.json(
        { error: 'Failed to fetch templates from database', details: error.message },
        { status: 500 }
      );
    }

    // Handle case where no templates are found
    if (!templates || templates.length === 0) {
      console.log(`[User: ${userId}] No templates found for the given criteria`);
      return NextResponse.json(
        // Return empty array instead of 404, as finding nothing isn't strictly an error
        { templates: [] }, 
        { status: 200 }
      );
    }

    // Return the selected templates
    console.log(`[User: ${userId}] Returning ${templates.length} templates`);
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