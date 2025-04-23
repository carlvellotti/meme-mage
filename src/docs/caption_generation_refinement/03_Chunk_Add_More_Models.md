# Chunk 3: Add More Models

## Goals

*   Extend the unified API endpoint's provider map (`/api/ai/chat`) to support Groq and Google Gemini models.
*   Handle potential **SDK nuances**, **context window limitations**, and configure optional **regional endpoints**.
*   Maintain consistent **environment variable naming**.
*   Update the backend testing route (`/api/dev/test-captions`) model list.

## Technical Details (Pseudocode / Steps)

1.  **Integrate Groq (`src/app/api/ai/chat/route.ts` - Provider Map):**
    *   Add entries to the `providers` map for desired Groq models:
        ```javascript
        'groq-llama3-70b': {
          init: createOpenAI,
          model: 'llama3-70b-8192',
          apiKeyEnv: 'GROQ_API_KEY',
          baseURL: 'https://api.groq.com/openai/v1'
        },
        // Add other Groq models like mixtral if needed
        ```
    *   Use `createOpenAI` but pass the `baseURL` specific to Groq.

2.  **Integrate Google Gemini (`src/app/api/ai/chat/route.ts` - Provider Map):**
    *   Ensure `@ai-sdk/google` is installed: `npm install @ai-sdk/google`.
    *   Add entries for Gemini models:
        ```javascript
        'gemini-1.5-pro': {
          init: createGoogleGenerativeAI,
          model: 'models/gemini-1.5-pro-latest',
          apiKeyEnv: 'GOOGLE_GEMINI_API_KEY',
          // options: { // Optional: Add region if needed
          //   location: 'us-central1' 
          // }
        },
        'gemini-1.5-flash': {
          init: createGoogleGenerativeAI,
          model: 'models/gemini-1.5-flash-latest',
          apiKeyEnv: 'GOOGLE_GEMINI_API_KEY',
          // options: { ... }
          // **Context Limit Handling:** Needs specific logic before calling
        },
        ```
    *   Use `createGoogleGenerativeAI` imported from `@ai-sdk/google`.
    *   Store API key env name using the standardized `GOOGLE_GEMINI_API_KEY`.
    *   **(SDK Nuances):** Verify if Gemini returns responses in the same structure as others (`result.text` containing the JSON string) via `generateText`. If not, add normalization logic within the unified API route's response handling for Gemini models.
    *   **(Context Limit Handling):** For models like Flash with smaller context windows, implement logic *before* calling the AI:
        *   Estimate token count of the prompt (system + user messages).
        *   If estimated count exceeds a threshold for the specific model (e.g., Flash), truncate the `userMessageContent` (specifically the template instructions part) smartly before sending the request.
        *   This logic can be added within the main API route, checking `providerConfig.model` or adding a `maxContextTokens` field to the provider map entry.

3.  **Update Environment Variables:**
    *   Add `GROQ_API_KEY` and `GOOGLE_GEMINI_API_KEY` (and `TEST_ROUTE_SECRET` if not already added) to `.env.local`.

4.  **Update Testing Route (`src/app/api/dev/test-captions/route.ts`):**
    *   Modify the `modelsToTest` array to include the new model identifiers (matching the keys added to the provider map):
        ```javascript
        const modelsToTest = [
          'openai',
          'anthropic-3.5',
          'anthropic-3.7',
          'groq-llama3-70b',
          'gemini-1.5-pro',
          'gemini-1.5-flash'
        ];
        ```

## Testing Points

*   Verify Groq and Google API keys are correctly configured.
*   Send test requests directly to `/api/ai/chat` specifying the new Groq and Gemini model IDs (both streaming and non-streaming). Confirm successful responses and consistent structure (or that normalization works).
*   Specifically test `gemini-1.5-flash` with a long template description to ensure context limit handling/truncation logic works correctly (check logs or verify the call doesn't fail due to context length).
*   Run the `/api/dev/test-captions` route. Confirm the output JSON now includes keys and results for the Groq and Gemini models.
*   Check persisted test results in the database for the new models.
*   Test error handling if API keys are missing/invalid for Groq/Google. 