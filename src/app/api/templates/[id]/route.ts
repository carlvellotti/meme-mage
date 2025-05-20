import { createClient } from '@/lib/supabase/route';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateEmbedding } from '@/lib/utils/embeddings';
import { getGeminiVideoAnalysisPrompt } from '@/lib/utils/prompts';

// Placeholder for MemeTemplate type (adjust as per your actual types.ts)
interface MemeTemplate {
  id: string;
  name: string;
  instructions: string;
  video_url?: string | null;
  scraped_example_caption?: string | null; // Added for re-analysis
  embedding?: any; // Or number[]
  reviewed?: boolean | null;
  is_duplicate?: boolean | null;
  category?: string | null;
  uploader_name?: string | null;
  original_source_url?: string | null;
  poster_url?: string | null;
  last_reanalyzed_at?: string | null;
}

// Replace placeholder with actual implementation
async function runVideoAnalysisWithAI(
  videoUrl: string, 
  exampleCaption: string | null, 
  feedbackContext: string | null,
  currentRequest: NextRequest // To build the absolute URL for internal fetch
): Promise<{ suggestedName: string | null; analysis: string | null; }> {
  console.log(`[runVideoAnalysisWithAI] Calling internal /api/analyze-video-template for video: ${videoUrl}`);
  
  const analyzeApiUrl = new URL('/api/analyze-video-template', currentRequest.url).toString();
  
  try {
    const response = await fetch(analyzeApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl: videoUrl,
        exampleCaption: exampleCaption,
        feedbackContext: feedbackContext
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[runVideoAnalysisWithAI] Internal call to /api/analyze-video-template failed with status ${response.status}: ${errorBody}`);
      throw new Error(`Internal analysis API call failed: ${response.status} - ${errorBody}`);
    }

    const result = await response.json();
    console.log('[runVideoAnalysisWithAI] Successfully received response from internal analysis API.');
    return {
      suggestedName: result.suggestedName || null,
      analysis: result.analysis || null,
    };

  } catch (error: any) {
    console.error('[runVideoAnalysisWithAI] Error during internal fetch to /api/analyze-video-template:', error);
    return { suggestedName: null, analysis: null }; 
  }
}

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

  const { name, instructions, reviewed, is_duplicate, category, triggerReanalysis, feedbackContext } = body;

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
   if (is_duplicate !== undefined && typeof is_duplicate !== 'boolean') {
       return NextResponse.json({ error: 'Invalid is_duplicate format' }, { status: 400 });
   }
   if (category !== undefined && category !== null && typeof category !== 'string') {
       return NextResponse.json({ error: 'Invalid category format' }, { status: 400 });
   }
   if (triggerReanalysis !== undefined && typeof triggerReanalysis !== 'boolean'){
      return NextResponse.json({ error: 'Invalid triggerReanalysis format' }, { status: 400 });
  }
  if (feedbackContext !== undefined && typeof feedbackContext !== 'string'){
      return NextResponse.json({ error: 'Invalid feedbackContext format' }, { status: 400 });
  }
  if (triggerReanalysis && (feedbackContext === undefined || feedbackContext.trim() === '')) {
      return NextResponse.json({ error: 'Feedback context is required when triggering re-analysis' }, { status: 400 });
  }

  const updateData: Partial<MemeTemplate> = {};
  let hasSyncUpdates = false;

  if (name !== undefined) {
    updateData.name = name;
    hasSyncUpdates = true;
  }
  if (reviewed !== undefined) {
    updateData.reviewed = reviewed;
    hasSyncUpdates = true;
  }
  if (is_duplicate !== undefined) {
      updateData.is_duplicate = is_duplicate;
      hasSyncUpdates = true;
  }
  if (category !== undefined) {
      updateData.category = category;
      hasSyncUpdates = true;
  }

  // Handle direct instructions update and re-vectorization (synchronous part)
  if (instructions !== undefined) {
    updateData.instructions = instructions;
    hasSyncUpdates = true;
    try {
      console.log(`[PATCH /api/templates/${id}] Sync: Re-generating embedding for updated instructions...`);
      const embeddingVector = await generateEmbedding(instructions);
      updateData.embedding = embeddingVector;
      console.log(`[PATCH /api/templates/${id}] Sync: New embedding generated.`);
    } catch (error: any) {
      console.error(`[PATCH /api/templates/${id}] Sync: Embedding generation failed:`, error);
      return NextResponse.json({ error: `Sync: Failed to update embedding: ${error.message || 'Unknown error'}` }, { status: 500 });
    }
  }

  let syncUpdateResponse: MemeTemplate | null = null;

  if (hasSyncUpdates) {
    console.log(`[PATCH /api/templates/${id}] Sync: Updating template with data:`, updateData);
    try {
      const { data: updatedTemplateData, error: syncError } = await supabaseAdmin
        .from('meme_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (syncError) {
        console.error(`[PATCH /api/templates/${id}] Sync: Supabase update error:`, syncError);
        if (syncError.code === 'PGRST116') {
            return NextResponse.json({ error: `Sync: Template with ID ${id} not found.` }, { status: 404 });
        }
        throw syncError;
      }
      syncUpdateResponse = updatedTemplateData as MemeTemplate;
      console.log(`[PATCH /api/templates/${id}] Sync: Update successful.`);
    } catch (error: any) {
      console.error(`[PATCH /api/templates/${id}] Sync: Error updating template:`, error);
      return NextResponse.json({ error: `Sync: ${error?.message || 'Failed to update template'}` }, { status: 500 });
    }
  }

  // Handle Asynchronous Re-analysis
  if (triggerReanalysis && feedbackContext) {
    console.log(`[PATCH /api/templates/${id}] Re-analysis triggered with feedback.`);
    
    const originalRequest = request; // Capture the request for use in the async block

    (async () => {
        try {
            console.log(`[PATCH /api/templates/${id}] Background: Starting re-analysis process for template ${id}...`);
            // 1. Fetch the template again to get video_url and other necessary fields
            const { data: templateForReanalysis, error: fetchError } = await supabaseAdmin
                .from('meme_templates')
                .select('video_url, original_source_url, scraped_example_caption') // Added scraped_example_caption
                .eq('id', id)
                .single();

            if (fetchError || !templateForReanalysis) {
                console.error(`[PATCH /api/templates/${id}] Background: Failed to fetch template for re-analysis:`, fetchError);
                return; // Exit background task
            }

            const videoUrlToAnalyze = templateForReanalysis.video_url || templateForReanalysis.original_source_url;
            if (!videoUrlToAnalyze) {
                console.error(`[PATCH /api/templates/${id}] Background: No video_url or original_source_url found for template ${id}. Cannot re-analyze.`);
                return; // Exit background task
            }

            // 2. Call the internal analysis API
            console.log(`[PATCH /api/templates/${id}] Background: Calling runVideoAnalysisWithAI for video: ${videoUrlToAnalyze}`);
            const { suggestedName: newSuggestedName, analysis: newAnalysis } = await runVideoAnalysisWithAI(
                videoUrlToAnalyze,
                templateForReanalysis.scraped_example_caption || null, // Pass scraped_example_caption
                feedbackContext, // This is from the original PATCH request body
                originalRequest // Pass the original request object
            );

            if (!newAnalysis || !newSuggestedName) {
                console.error(`[PATCH /api/templates/${id}] Background: Video analysis returned null or invalid analysis. Aborting update.`);
                return;
            }

            // 3. Prepare data for update
            const reanalysisUpdateData: Partial<MemeTemplate> = {
                // Only update name if a new one is suggested and is a non-empty string
                ...(newSuggestedName && newSuggestedName.trim() !== '' ? { name: newSuggestedName } : {}),
                instructions: newAnalysis, // newAnalysis is a string here
            };

            // 4. Generate new embedding for the new analysis
            try {
                console.log(`[PATCH /api/templates/${id}] Background: Re-generating embedding for AI analysis...`);
                const newEmbeddingVector = await generateEmbedding(newAnalysis as string); // Explicit cast after check
                reanalysisUpdateData.embedding = newEmbeddingVector;
                console.log(`[PATCH /api/templates/${id}] Background: New embedding generated for AI analysis.`);
            } catch (embeddingError: any) {
                console.error(`[PATCH /api/templates/${id}] Background: Embedding generation failed for AI analysis:`, embeddingError);
                // Decide: update without embedding or log and skip update?
                // For now, log and continue without new embedding if it fails.
            }
            
            // 5. Update the template in Supabase with AI-generated content
            const { error: reanalysisDbError } = await supabaseAdmin
                .from('meme_templates')
                .update(reanalysisUpdateData)
                .eq('id', id);

            if (reanalysisDbError) {
                console.error(`[PATCH /api/templates/${id}] Background: Supabase update error after re-analysis:`, reanalysisDbError);
            } else {
                console.log(`[PATCH /api/templates/${id}] Background: Template successfully updated with re-analyzed content.`);
            }

        } catch (backgroundError: any) {
            console.error(`[PATCH /api/templates/${id}] Background: Error during re-analysis process:`, backgroundError);
        }
    })(); // Self-invoking async function for background processing

    return NextResponse.json({ message: 'Re-analysis process started.', template: syncUpdateResponse }, { status: 202 });
  }

  // If only synchronous updates were made and no re-analysis
  if (hasSyncUpdates && syncUpdateResponse) {
    return NextResponse.json(syncUpdateResponse, { status: 200 });
  }

  // If no synchronous updates and no re-analysis trigger
  if (!triggerReanalysis) {
      return NextResponse.json({ error: 'No valid fields provided for update or re-analysis not triggered' }, { status: 400 });
  }
  
  // Fallback, should ideally be covered by above conditions
  return NextResponse.json({ error: 'Unhandled request' }, { status: 500 });
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