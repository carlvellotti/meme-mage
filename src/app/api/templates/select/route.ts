import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server'; // Use server client for API routes
import { OpenAI } from 'openai'; // Import the class
import { MemeTemplate } from '@/lib/supabase/types'; // Import your type

// Input validation schema
const TemplateSelectSchema = z.object({
  prompt: z.string().optional(),
  audience: z.string().optional(), // Currently unused in logic, but good to validate
  count: z.number().int().positive().max(10).default(3), // Default to 3, max 10
  isGreenscreenMode: z.boolean().optional(),
});

export async function POST(request: Request) {
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

    const { prompt, count, isGreenscreenMode } = validationResult.data;
    const supabase = createClient();

    let templates: MemeTemplate[] | null = null;
    let error: any = null;

    if (prompt && prompt.trim().length > 0) {
      // --- Vector Search Logic ---
      console.log(`Performing vector search for prompt: "${prompt}"`);
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
        const { data: matchedData, error: matchError } = await supabase.rpc(
          'match_meme_templates',
          {
            query_embedding: embedding,
            match_threshold: 0.7, // Adjust threshold as needed
            match_count: count,
            filter_greenscreen: isGreenscreenMode, // Pass the filter
          }
        );

        if (matchError) throw matchError;
        templates = matchedData;
        console.log(`Found ${templates?.length ?? 0} templates via vector search.`);

      } catch (e) {
        console.error('Error during vector search:', e);
        error = e;
      }
    } else {
      // --- Random Selection Logic ---
      console.log('Performing random template selection.');
      try {
        // Call Supabase RPC function 'get_random_meme_templates'
        const { data: randomData, error: randomError } = await supabase.rpc(
          'get_random_meme_templates',
          {
            limit_count: count,
            filter_greenscreen: isGreenscreenMode, // Pass the filter
          }
        );

        if (randomError) throw randomError;
        templates = randomData;
        console.log(`Found ${templates?.length ?? 0} random templates.`);

      } catch (e) {
        console.error('Error during random selection:', e);
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
        { error: 'No matching templates found' },
        { status: 404 }
      );
    }

    // Return the selected templates
    return NextResponse.json({ templates });

  } catch (e: any) {
    // Catch errors from request parsing or unexpected issues
    console.error('Unexpected Error in /api/templates/select:', e);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: e.message },
      { status: 500 }
    );
  }
} 