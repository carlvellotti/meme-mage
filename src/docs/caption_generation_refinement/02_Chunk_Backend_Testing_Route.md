# Chunk 2: Backend Testing Route

## Goals (Achieved)

*   Created a dedicated, secure API endpoint (`/api/dev/test-captions`) for triggering caption generation tests across multiple models.
*   Fetched required meme template data (`name`, `instructions`) directly from Supabase (caching deferred).
*   Orchestrated parallel calls to the unified AI endpoint (`/api/ai/chat`) for each configured model being tested (Anthropic 3.5/3.7, Gemini 2.5 Pro, Grok tested).
*   Parsed the structured JSON response (`{ "captions": [...] }`) from the AI, **including logic to strip potential Markdown code fences**.
*   Persisted test results (captions, latency, errors) to a new `caption_tests` database table for later analysis.
*   Returned a structured JSON response comparing the generated captions, latency, and any errors from each model.

## Final Implementation Details (`src/app/api/dev/test-captions/route.ts`)

1.  **Route Setup:**
    *   Uses Next.js App Router `POST` handler with Edge Runtime (`export const runtime = 'edge';`).
2.  **Security & Validation:**
    *   Checks for `x-test-secret` header against `process.env.TEST_ROUTE_SECRET`.
    *   Checks for presence of `process.env.AI_API_SECRET_TOKEN`.
    *   Uses Zod (`RequestBodySchema`) to validate the incoming JSON body: `{ templateId: string (UUID), userPrompt: string, audience: string }`.
3.  **Data Fetching:**
    *   Initializes Supabase server client (`@/lib/supabase/server`).
    *   Fetches `name` and `instructions` from `meme_templates` table based on `templateId`. Handles "not found" and other database errors.
4.  **AI Input Preparation:**
    *   Imports and uses `getCaptionGenerationTestPrompt` from `@/lib/utils/prompts`.
    *   Constructs `system` and `user` messages (`CoreMessage[]`) based on the test prompt, audience, user prompt, and template details.
5.  **Parallel AI Calls:**
    *   Defines `modelsToTest` array (initially included OpenAI, Anthropic, Google, Grok; OpenAI models were later commented out during testing).
    *   Uses `Promise.all` to map over `modelsToTest`.
    *   Each promise makes an async `fetch` call to the unified `/api/ai/chat` endpoint.
    *   Fetch includes `Authorization: Bearer ${AI_API_SECRET_TOKEN}` header and `{ model, messages }` body.
    *   Calculates latency for each call.
6.  **Response Processing & Parsing:**
    *   Handles non-OK HTTP responses from `/api/ai/chat`.
    *   Handles potential `fetch` errors.
    *   **Crucially:** Attempts to strip Markdown code fences (e.g., ` ```json\n...\n``` ` or ` ```...``` `) from the `response.response` string before attempting `JSON.parse()`.
    *   Validates the parsed JSON structure matches `{ captions: [...] }`.
    *   Stores parsed captions, errors (fetch, API, or parse), raw response (if error occurred), and latency.
7.  **Persistence:**
    *   Maps processed results to include `template_id`, `user_prompt`, `audience`.
    *   Inserts all results into the `caption_tests` Supabase table in a single `insert` call.
    *   Logs but does not fail the request if insertion fails.
8.  **Final Response:**
    *   Formats a JSON response containing:
        *   `message`: Status message.
        *   `testInput`: Echoed input parameters.
        *   `modelResults`: An object keyed by `modelId`, showing `latency`, `captions` (if successful), `error` (if any), and `raw_response_on_error`.
        *   `databaseWarning`: Optional message if Supabase insert failed.

## Testing

*   **Verify Security:** Route should return 401/403 without/with incorrect `x-test-secret` header.
*   **Verify Validation:** Route should return 400 for invalid/missing `templateId`, `userPrompt`, or `audience`.
*   **Test Valid Run (Example using `curl` and `jq`):**
    ```bash
    # Replace placeholders with your actual values
    # Ensure TEST_ROUTE_SECRET=YOUR_TEST_SECRET is in .env.local
    # Ensure your dev server (npm run dev) is running
    curl -X POST http://localhost:3000/api/dev/test-captions \
      -H "Content-Type: application/json" \
      -H "x-test-secret: YOUR_TEST_SECRET" \
      -d '{
        "templateId": "YOUR_TEMPLATE_ID_UUID",
        "userPrompt": "YOUR_MEME_IDEA_OR_PROMPT",
        "audience": "YOUR_TARGET_AUDIENCE"
      }' | jq 
    ```
*   **Check Output:** Verify presence of all expected model keys in response, correctly parsed `captions` array (especially after fence stripping for models like Gemini), reasonable `latency` values, and error reporting for failed calls/parsing.
*   **Check Database:** Confirm test run data (inputs, outputs, latency, errors per model) is successfully persisted in the `caption_tests` table in Supabase.
*   **Test Edge Cases:**
    *   Invalid `templateId` (should return 404 before AI calls).
    *   Simulate failure/invalid JSON from `/api/ai/chat` (check error reporting in response and DB).

## Final Implementation Notes

*   Initial testing included OpenAI models, but they were commented out in the final version of `modelsToTest` in the code (`openai-4.1`, `openai-4o`).
*   Logic to strip Markdown code fences was added to handle inconsistencies in AI model outputs (observed with Gemini).
*   Template data caching was deferred to simplify initial implementation.
*   Moderation of generated captions was not included in this specific route. 