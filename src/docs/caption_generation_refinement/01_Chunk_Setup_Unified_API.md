# Chunk 1: Setup & Unified API Endpoint

## Goals

*   Create the necessary prompt structure for isolated caption generation testing, ensuring it requests **structured JSON output**.
*   Establish a single, scalable API endpoint (`/api/ai/chat`) for handling requests to different AI models.
*   Integrate OpenAI (GPT-4.1, GPT-4o), Anthropic (Claude 3.5 & 3.7 Sonnet), and Google (Gemini 1.5 Pro) models using Vercel AI SDK providers and a flexible **provider map** configuration.
*   Integrate xAI's Grok model using a direct **fetch** call, handling it separately from the SDK providers.
*   Implement robust **input validation** (Zod), **authentication** (Bearer token), and basic **observability** hooks (`console.log`).
*   Establish strong **type safety** for API interactions.
*   *Deferred:* Implement retry logic for provider calls.
*   *Deferred:* Implement streaming support (removed as not needed for this project).

## Implementation Summary (Actual)

1.  **New Prompt (`src/lib/utils/prompts.ts`):**
    *   Added `getCaptionGenerationTestPrompt(audience: string)`. Based on `getMemeSystemPrompt` but modified to focus on generating 3 captions for a single template and outputting structured JSON: `{"captions": ["caption A", "caption B", "caption C"]}`.

2.  **Unified API Route (`src/app/api/ai/chat/route.ts`):**
    *   Created the route with `export const runtime = "edge";`.
    *   Uses Next.js App Router `POST` handler.
    *   **Input Validation (Zod):**
        *   Defined `RequestBodySchema` for `{ model: z.enum([...]), messages: z.array(...) }`. Valid model IDs: `'openai-4.1'`, `'openai-4o'`, `'anthropic-3.5'`, `'anthropic-3.7'`, `'google-gemini-2.5-pro'`, `'grok-3-latest'`. Streaming field was removed.
        *   Validates request body; returns 400 on failure.
    *   **Authentication:**
        *   Expects `Authorization: Bearer YOUR_SECRET_TOKEN` header.
        *   Compares token against `process.env.AI_API_SECRET_TOKEN`. Returns 401/403 on mismatch.
    *   **Provider Configuration Map & Logic:**
        *   Defined `providers` map for SDK-supported models (OpenAI, Anthropic, Google) with `init`, `model` ID, and `apiKeyEnv`.
            *   OpenAI: `gpt-4.1`, `gpt-4o`
            *   Anthropic: `claude-3-5-sonnet-20241022`, `claude-3-7-sonnet-20250219`
            *   Google: `gemini-1.5-pro-latest`
        *   **Special Grok Handling:** Implemented an `if (modelId === 'grok-3-latest')` block before the SDK provider logic.
            *   Checks for `process.env.GROK_API_KEY`.
            *   Uses `fetch` to call `https://api.x.ai/v1/chat/completions` directly.
            *   Handles non-streaming JSON response (parsing `choices[0].message.content`).
        *   **SDK Logic (Other Models):**
            *   Looks up `providerConfig`.
            *   Retrieves API key from `process.env`.
            *   Instantiates provider using `providerConfig.init` and casts to `LanguageModelV1`.
            *   Calls `generateText` for non-streaming response.
            *   Returns response as `NextResponse.json({ response: ... })`.
    *   **Observability:** Added basic `console.log` statements for request start, auth success, model processing, API call timing, and errors.
    *   **Retry Logic:** *Not implemented* in this chunk to prioritize testing.
    *   **Type Safety:** Used TypeScript interfaces/types (`ValidatedRequestBody`, `ChatMessage`).

3.  **Environment Variables:**
    *   Requires `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `GROK_API_KEY`, and `AI_API_SECRET_TOKEN` in `.env.local`.

## Testing Points (Updated)

*   Verify the `getCaptionGenerationTestPrompt` asks for JSON output.
*   Verify API returns 401/403 without/with incorrect `Authorization` header (`AI_API_SECRET_TOKEN`).
*   Verify API returns 400 for invalid request body structure (use Zod schema errors).
*   Verify API returns 400 for unsupported `model` IDs.
*   Send valid requests (using `curl`/Postman with correct auth):
    *   Test each configured `model` ID (`openai-4.1`, `openai-4o`, `anthropic-3.5`, `anthropic-3.7`, `google-gemini-2.5-pro`, `grok-3-latest`).
    *   Verify a valid JSON response (`{ response: "..." }`) is received from each.
*   Check server logs (`console.log`) for basic observability data (model, duration, errors).
*   Verify API returns 500 if a required provider API key (e.g., `OPENAI_API_KEY`, `GROK_API_KEY`) is missing from `.env.local`.

---
*Original Plan Below (for reference)*

## Technical Details (Pseudocode / Steps) - *Original Plan*

1.  **Create New Testing Prompt (`src/lib/utils/prompts.ts`):**
    *   Define `getCaptionGenerationTestPrompt(audience: string): string`.
    *   Copy/adapt `getMemeSystemPrompt`.
    *   **Modify:**
        *   Remove template *selection* instructions.
        *   Adjust input description for a *single* template.
        *   **Crucially:** Modify output format instructions to request **valid JSON** exactly like this: `{"captions": ["caption A text", "caption B text", "caption C text"]}`. Emphasize adherence to this JSON structure.

2.  **Implement Unified API Route (`src/app/api/ai/chat/route.ts`):**
    *   Create the route file. Consider `export const runtime = "edge";` if all initial providers support it.
    *   Use Next.js App Router `POST` handler.
    *   **Input Validation (Zod):**
        *   Define a Zod schema for the request body: `{ model: z.string(), messages: z.array(z.object({ role: z.enum(['user', 'system', 'assistant']), content: z.string() })), stream: z.boolean().optional() }`.
        *   Parse and validate the request body using the schema. Return 400 error on failure.
    *   **Authentication:**
        *   Expect an `Authorization: Bearer YOUR_SECRET_TOKEN` header.
        *   Compare the token against an environment variable (`AI_API_SECRET_TOKEN`). Return 401/403 on mismatch.
    *   **Provider Configuration Map:**
        *   Define a map object: `const providers = { 'openai': { init: createOpenAI, model: 'gpt-4', apiKeyEnv: 'OPENAI_API_KEY' }, 'anthropic-3.5': { init: createAnthropic, model: 'claude-3-5-sonnet-20240620', apiKeyEnv: 'ANTHROPIC_API_KEY' }, /* ... more later */ };`
        *   Include necessary details like the initialization function, specific model ID, and the env var name for the API key.
    *   **Core Logic:**
        *   Get `model` identifier and `messages` from validated request body.
        *   Look up `providerConfig = providers[model]`.
        *   Handle case where model is not found (400 error).
        *   Retrieve API key: `const apiKey = process.env[providerConfig.apiKeyEnv];` Handle missing key error.
        *   Instantiate provider: `const aiProvider = providerConfig.init({ apiKey });`.
        *   **Retry Logic:** Wrap the AI call in a simple retry mechanism (e.g., using `p-retry` or a basic loop with delay) to handle transient errors (like 5xx).
        *   **Observability:** Before calling the AI, record start time. After, record end time, calculate duration. Log model used, duration, estimated input/output tokens (if available from response), and success/error status.
        *   **Streaming vs. Non-Streaming:**
            *   If `stream === true`:
                *   Call `streamText({ model: aiProvider(providerConfig.model), messages })`.
                *   Return the `StreamingTextResponse` directly.
            *   Else (`stream === false` or undefined):
                *   Call `generateText({ model: aiProvider(providerConfig.model), messages })`.
                *   Return the `result.text` (or structured object if applicable) as JSON: `Response.json({ response: result.text })`.
    *   **Type Safety:** Define shared interfaces/types (e.g., `ChatMessage`, `AIRequest`, `AIResponse`) and use them for request/response handling.

3.  **Environment Variables:**
    *   Define `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `AI_API_SECRET_TOKEN` in `.env.local`. 