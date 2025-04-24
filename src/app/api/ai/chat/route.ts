import { NextResponse } from 'next/server';
import {
  generateText,
  CoreMessage,
  LanguageModelV1,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/route'; // Use route handler client

export const runtime = 'edge';

// Define the expected request body schema using Zod
const RequestBodySchema = z.object({
  model: z.enum([
    'openai-4.1',
    'openai-4o',
    'anthropic-3.5',
    'anthropic-3.7',
    'google-gemini-2.5-pro',
    'grok-3-latest'
  ]),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    })
  ),
});

// Define a type for validated request body
type ValidatedRequestBody = z.infer<typeof RequestBodySchema>;

// Define the structure for chat messages based on Vercel AI SDK CoreMessage
type ChatMessage = CoreMessage;

// Define the provider configuration map (excluding Grok, handled separately)
const providers = {
  'openai-4.1': {
    init: createOpenAI,
    model: 'gpt-4.1',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  'openai-4o': {
    init: createOpenAI,
    model: 'gpt-4o',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  'anthropic-3.5': {
    init: createAnthropic,
    model: 'claude-3-5-sonnet-20241022',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  },
  'anthropic-3.7': {
    init: createAnthropic,
    model: 'claude-3-7-sonnet-20250219',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  },
  'google-gemini-2.5-pro': {
    init: createGoogleGenerativeAI,
    model: 'gemini-2.5-pro-preview-03-25',
    apiKeyEnv: 'GOOGLE_API_KEY',
  }
};

export async function POST(req: Request) {
  console.log('Received request to /api/ai/chat');

  // --- Authentication Check --- 
  const supabase = createClient(); // Call helper without args
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn('Unauthorized API access attempt to /api/ai/chat');
    // TODO: Log auth failure details (IP, user-agent)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id; 
  // --------------------------

  try {
    // 2. Input Validation
    const requestJson = await req.json();
    const validationResult = RequestBodySchema.safeParse(requestJson);

    if (!validationResult.success) {
      console.warn(`[User: ${userId}] Invalid request body:`, validationResult.error.errors);
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { model: modelId, messages } = validationResult.data;
    console.log(`[User: ${userId}] Processing request for model: ${modelId}`);

    // --- Special Handling for Grok (xAI) --- 
    if (modelId === 'grok-3-latest') {
      const grokApiKey = process.env.GROK_API_KEY; // Use GROK_API_KEY
      if (!grokApiKey) {
        console.error(`[User: ${userId}] GROK_API_KEY is not set.`);
        return NextResponse.json({ error: 'API key configuration error for Grok' }, { status: 500 });
      }

      const grokApiUrl = 'https://api.x.ai/v1/chat/completions';
      const body = JSON.stringify({
        messages: messages, // Assuming Grok uses the same message format
        model: 'grok-3-latest',
      });

      console.log(`[User: ${userId}] Calling Grok (xAI) API...`);
      const startTime = Date.now();

      const response = await fetch(grokApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${grokApiKey}`,
          'Content-Type': 'application/json',
        },
        body: body,
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[User: ${userId}] Grok API error (${response.status}): ${errorBody}`);
        return NextResponse.json({ error: 'Grok API request failed', details: errorBody }, { status: response.status });
      }

      console.log(`[User: ${userId}] Grok non-streaming response received in ${duration}ms`);
      const jsonResponse = await response.json();
      // Assuming Grok's non-streaming response has a structure like { choices: [{ message: { content: '...' } }] }
      // Adjust based on actual Grok API response format
      const responseContent = jsonResponse?.choices?.[0]?.message?.content || jsonResponse;
      return NextResponse.json({ response: responseContent });
    }
    // --- End of Grok Handling ---

    // 3. Provider Lookup (For non-Grok models)
    const providerConfig = providers[modelId as keyof typeof providers];

    if (!providerConfig) {
      console.error(`[User: ${userId}] Unsupported model requested (post-Grok check): ${modelId}`);
      return NextResponse.json(
        { error: 'Unsupported model' },
        { status: 400 }
      );
    }

    // 4. API Key Retrieval
    const apiKey = process.env[providerConfig.apiKeyEnv];
    if (!apiKey) {
      console.error(`[User: ${userId}] API key ${providerConfig.apiKeyEnv} is not set.`);
      return NextResponse.json(
        { error: `API key configuration error for ${modelId}` },
        { status: 500 }
      );
    }

    // 5. Instantiate Provider
    const aiProvider = providerConfig.init({ apiKey });
    const modelInstance = aiProvider(providerConfig.model) as LanguageModelV1;

    console.log(`[User: ${userId}] Calling ${modelId} model: ${providerConfig.model} via Vercel SDK`);
    const sdkStartTime = Date.now();

    // 6. Call AI Model via Vercel SDK (Non-Streaming only)
    const result = await generateText({
      model: modelInstance,
      messages: messages as CoreMessage[],
    });
    const sdkDuration = Date.now() - sdkStartTime;
    console.log(`[User: ${userId}] Vercel SDK Non-streaming response received from ${modelId} in ${sdkDuration}ms`);
    return NextResponse.json({ response: result.text });

  } catch (error: any) {
    console.error(`[User: ${userId}] Error processing /api/ai/chat request:`, error);

    // Provide more context on the error if possible
    const errorMessage = error.message || 'Internal Server Error';
    const errorDetails = error.cause || error.stack || undefined;

    return NextResponse.json(
      { error: 'Failed to process AI request', details: errorMessage, cause: errorDetails },
      { status: 500 }
    );
  }
}
