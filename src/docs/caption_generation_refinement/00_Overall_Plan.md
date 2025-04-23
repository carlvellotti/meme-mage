# Meme Caption Generation Refinement Plan

## 1. Goals

*   **Evaluate Multiple AI Models:** Compare the caption generation quality of various LLMs (OpenAI, Anthropic, Groq, Gemini) for meme creation.
*   **Refine Captioning Prompt:** Develop and test a dedicated prompt for generating meme captions based on a specific template, prompt, and audience, separate from template selection.
*   **Improve API Scalability:** Refactor the AI interaction backend into a single, unified API endpoint to easily add and manage different models.
*   **Isolate Testing:** Create a backend-only testing mechanism to evaluate models and prompts without affecting the live user experience.
*   **Inform Future Integration:** Use the findings to make informed decisions about which model(s) and prompt(s) to use in the primary meme generation feature.

## 2. Implementation Chunks

*   [x] **Chunk 1: Setup & Unified API Endpoint**
    *   [x] Create a new, isolated prompt for caption generation testing (outputting structured JSON).
    *   [x] Implement a unified API route (`/api/ai/chat`) using Vercel AI SDK (and custom fetch for Grok).
    *   [x] Add support for OpenAI, Anthropic, Google models via SDK and Grok via fetch using a provider map/conditional logic.
    *   [x] Implement Zod validation, Bearer token auth, basic observability hooks.
    *   *Note: Retry logic for provider calls was deferred to prioritize testing.*
*   [x] **Chunk 2: Backend Testing Route**
    *   [x] Created dedicated testing API route (`/api/dev/test-captions`) secured with `x-test-secret` header.
    *   [x] Implemented logic to fetch meme template data (name, instructions) from Supabase.
    *   [x] Used the `getCaptionGenerationTestPrompt` and parsed structured JSON response, handling potential Markdown fences.
    *   [x] Called the unified `/api/ai/chat` endpoint for multiple models (Anthropic, Google, Grok tested) in parallel using `Promise.all`.
    *   [x] Structured and returned comparison results (captions, latency, errors) as JSON.
    *   [x] Implemented persistence of test runs to new `caption_tests` Supabase table.
    *   *Note: Template data caching was initially skipped.*
    *   *Testing Command Example:* 
        ```bash
        curl -X POST http://localhost:3000/api/dev/test-captions \
          -H "Content-Type: application/json" \
          -H "x-test-secret: YOUR_TEST_SECRET" \
          -d '{
            "templateId": "YOUR_TEMPLATE_ID",
            "userPrompt": "YOUR_USER_PROMPT",
            "audience": "YOUR_TARGET_AUDIENCE"
          }' | jq
        ```
*   [x] **Chunk 3: Add More Models**
    *   *Note: Integration of Groq and Google models was completed as part of the unified API in Chunk 1. Testing route in Chunk 2 confirmed their functionality.*
*   [/] **Chunk 4: Integration (Decision Made)**
    *   *Decision:* Skip detailed analysis and model selection. Proceed with using **multiple models** (Anthropic, Google, Grok) in the main generation flow.
    *   [ ] Refactor `AIMemeSelector.tsx` to call the unified `/api/ai/chat` endpoint for the selected models (Anthropic 3.7, Gemini 2.5 Pro, Grok latest suggested) using the current `getCaptionGenerationTestPrompt`.
    *   [ ] Update UI/state management in `AIMemeSelector.tsx` to handle responses from multiple models (e.g., display best result or allow user selection).
    *   [ ] Remove old, model-specific API routes and related frontend logic once refactor is complete.
    *   *Note: Feature flag originally planned for this refactor is no longer necessary due to the decision to use multiple models directly.*

## 3. Success Metrics

*   Successfully generate captions from all targeted models via the testing route, with results persisted.
*   Obtain comparable outputs (structured JSON) for quantitative and qualitative analysis.
*   Unified API endpoint successfully routes requests to the correct model provider, handles auth, validation, and retries.
*   Testing process remains isolated and secure.

## 4. Cross-Cutting Considerations

*   **Moderation:** Implement content moderation (e.g., OpenAI Moderation API, Hive) for all generated captions before they are potentially used.
*   **Unit Testing:** Add unit tests (e.g., using Vitest + MSW) for API routes to verify input validation, output parsing, error handling, and provider logic, stubbing actual AI calls.
*   **Type Safety:** Maintain strong type safety using TypeScript interfaces/types shared between frontend and backend where applicable (e.g., API request/response shapes).
*   **Observability:** Ensure sufficient logging (latency, cost estimates, errors) is implemented for monitoring and analysis.
*   **Security:** Consistently apply security best practices (e.g., environment variable secrets, auth checks). 