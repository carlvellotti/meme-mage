import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server'; // Import Supabase server client
import { getCaptionGenerationTestPrompt } from '@/lib/utils/prompts'; // Import the prompt function
import { CoreMessage } from 'ai'; // Import CoreMessage type
import { Json } from '@/lib/supabase/types'; // Import Json type

export const runtime = 'edge'; // Use Edge runtime for potential speed

const TEST_ROUTE_SECRET = process.env.TEST_ROUTE_SECRET;
const AI_API_SECRET_TOKEN = process.env.AI_API_SECRET_TOKEN;

// Define Zod schema for request body validation
const RequestBodySchema = z.object({
  templateId: z.string().uuid({ message: "Invalid template UUID" }),
  userPrompt: z.string().min(1, { message: "User prompt cannot be empty" }),
  audience: z.string().min(1, { message: "Audience cannot be empty" }),
});

// Define the list of models to test
const modelsToTest: string[] = [
  // 'openai-4.1', // Temporarily removed as requested
  // 'openai-4o', // Temporarily removed as requested
  'anthropic-3.5',
  'anthropic-3.7',
  'google-gemini-2.5-pro',
  'grok-3-latest'
];

export async function POST(req: NextRequest) {
  // 1. Security Check
  const secret = req.headers.get('x-test-secret');
  if (!TEST_ROUTE_SECRET || secret !== TEST_ROUTE_SECRET) {
    console.warn('Unauthorized attempt to access /api/dev/test-captions');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!AI_API_SECRET_TOKEN) {
    console.error('AI_API_SECRET_TOKEN is not set in environment variables.');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  console.log('Received authorized request for /api/dev/test-captions');

  try {
    // 2. Validate Request Body
    let validatedBody;
    try {
      const body = await req.json();
      validatedBody = RequestBodySchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Invalid request body', details: error.errors }, { status: 400 });
      } else if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
      }
      console.error('Error parsing request body:', error);
      return NextResponse.json({ error: 'Failed to parse request body' }, { status: 400 });
    }

    // 3. Fetch Template Data
    const supabase = createClient();
    const { data: templateData, error: templateError } = await supabase
      .from('meme_templates')
      .select('name, instructions')
      .eq('id', validatedBody.templateId)
      .single();

    if (templateError) {
       console.error('Supabase error fetching template:', templateError);
      if (templateError.code === 'PGRST116') {
         return NextResponse.json({ error: `Template not found with ID: ${validatedBody.templateId}` }, { status: 404 });
      }
      return NextResponse.json({ error: 'Database error fetching template' }, { status: 500 });
    }
    if (!templateData) {
      return NextResponse.json({ error: `Template not found with ID: ${validatedBody.templateId}` }, { status: 404 });
    }

    // 4. Prepare AI Inputs
    const systemPrompt = getCaptionGenerationTestPrompt(validatedBody.audience);
    const userMessageContent = `User Prompt: "${validatedBody.userPrompt}"\n\nTemplate Name: ${templateData.name}\nTemplate Instructions: ${templateData.instructions || 'None'}`;
    const messages: CoreMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessageContent },
    ];

    // 5. Call Unified AI API in Parallel and Process Results
    console.log(`Initiating parallel calls to ${modelsToTest.length} models...`);
    const callPromises = modelsToTest.map(async (modelId) => {
      const startTime = Date.now();
      let latency = 0;
      let status = 0;
      let responseOk = false;
      let rawApiResponse: any = null;
      let apiErrorText: string | null = null;
      let fetchErrorMsg: string | null = null;

      try {
        const apiUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const fullApiUrl = `${apiUrl}/api/ai/chat`;

        console.log(`Calling ${modelId} via ${fullApiUrl}...`);
        const response = await fetch(fullApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_API_SECRET_TOKEN}`,
          },
          body: JSON.stringify({ model: modelId, messages: messages }),
        });

        latency = Date.now() - startTime;
        status = response.status;
        responseOk = response.ok;
        console.log(`Response received from ${modelId} in ${latency}ms with status ${status}`);

        if (!responseOk) {
          apiErrorText = await response.text();
          console.error(`Error from ${modelId} (${status}): ${apiErrorText}`);
        } else {
          rawApiResponse = await response.json(); // Expects { response: "..." }
        }
      } catch (error: any) {
        latency = Date.now() - startTime; // Update latency on fetch error too
        fetchErrorMsg = error.message || 'Fetch failed';
        console.error(`Fetch error calling ${modelId}:`, error);
      }

      // Process the result for parsing and persistence structure
      let parsedCaptions: Json | null = null;
      let parseErrorMsg: string | null = null;
      let rawResponseForDb: string | null = null;

      if (responseOk && rawApiResponse?.response) {
        let jsonString = rawApiResponse.response;
        
        // **New:** Attempt to strip Markdown fences if present
        const markdownFenceStart = '```json\n';
        const markdownFenceEnd = '\n```';
        if (jsonString.startsWith(markdownFenceStart) && jsonString.endsWith(markdownFenceEnd)) {
          console.log(`Stripping Markdown fences from ${modelId} response.`);
          jsonString = jsonString.substring(markdownFenceStart.length, jsonString.length - markdownFenceEnd.length);
        } else if (jsonString.startsWith('```') && jsonString.endsWith('```')) {
            // Handle case with just ``` at start/end
            console.log(`Stripping simpler Markdown fences from ${modelId} response.`);
            jsonString = jsonString.substring(3, jsonString.length - 3);
        }

        try {
          // Parse the potentially cleaned string
          parsedCaptions = JSON.parse(jsonString); 
          
          // Basic validation: check if it has a 'captions' key and it's an array
          if (!parsedCaptions || typeof parsedCaptions !== 'object' || !Array.isArray((parsedCaptions as any).captions)) {
             throw new Error('Parsed JSON does not have expected { captions: [] } structure.');
          }
        } catch (parseError: any) {
          console.error(`Failed to parse JSON response from ${modelId} (after potential cleaning):`, parseError);
          parseErrorMsg = `JSON Parse Error: ${parseError.message}`;
          rawResponseForDb = rawApiResponse.response; // Store the original unparsable string
          parsedCaptions = null; // Ensure captions is null on parse error
        }
      } else {
         // Store the raw error text if the API call failed
         rawResponseForDb = apiErrorText;
      }

      // Prepare data for Supabase insertion and final response
      const resultForDb = {
        modelId: modelId,
        latency_ms: latency,
        captions: parsedCaptions,
        error_message: fetchErrorMsg || (responseOk ? parseErrorMsg : `API Error (${status})`) || null,
        raw_response: rawResponseForDb, // Only store raw response if parsing failed or API errored
      };

      return resultForDb;
    });

    const resultsArray = await Promise.all(callPromises);
    console.log('All parallel AI calls completed and responses processed.');

    // 6. Persist Results to Supabase
    const recordsToInsert = resultsArray.map(res => ({
      template_id: validatedBody.templateId,
      user_prompt: validatedBody.userPrompt,
      audience: validatedBody.audience,
      model_id: res.modelId,
      captions: res.captions,
      latency_ms: res.latency_ms,
      error_message: res.error_message,
      raw_response: res.raw_response,
    }));

    console.log(`Attempting to insert ${recordsToInsert.length} records into caption_tests...`);
    const { error: insertError } = await supabase
      .from('caption_tests')
      .insert(recordsToInsert);

    if (insertError) {
      // Log the error but don't block the response
      console.error('Supabase insert error:', insertError);
    }

    // 7. Format Final Response
    const modelResults = resultsArray.reduce((acc, res) => {
        acc[res.modelId] = {
            latency: res.latency_ms,
            ...(res.captions && { captions: (res.captions as any).captions }),
            ...(res.error_message && { error: res.error_message }),
            ...(res.raw_response && { raw_response_on_error: res.raw_response }),
        };
        return acc;
    }, {} as Record<string, any>); // Type assertion for accumulator

    return NextResponse.json(
      {
        message: 'Caption generation test completed.',
        testInput: {
          templateId: validatedBody.templateId,
          templateName: templateData.name,
          userPrompt: validatedBody.userPrompt,
          audience: validatedBody.audience,
        },
        modelResults: modelResults,
        ...(insertError && { databaseWarning: `Failed to persist some results: ${insertError.message}` })
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in /api/dev/test-captions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 