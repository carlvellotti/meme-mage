# Chunk 4: Analysis & Integration (Future)

## Goals

*   Systematically evaluate caption quality using **persisted test data** (captions, latency, cost).
*   Incorporate **objective scoring metrics** alongside subjective review.
*   Refine and **version** the `getCaptionGenerationTestPrompt` based on observed results.
*   Make a data-informed decision on the primary model(s) and prompt configuration, considering both quality and cost (**cost dashboard**).
*   Refactor the user-facing meme generation flow (`AIMemeSelector.tsx`) safely using a **feature flag**.

## Technical Details (Pseudocode / Steps)

1.  **Analysis Phase:**
    *   Run the `/api/dev/test-captions` route with diverse inputs.
    *   Query the `caption_tests` database table (or use observability tools) to gather results.
    *   **Evaluation Criteria:**
        *   **Subjective:** Adherence to styles, relevance, conciseness, audience fit, creativity, humor.
        *   **Objective:** Average caption length, emoji ratio, sentiment analysis scores, content filter scores (e.g., from moderation step), latency, estimated cost.
    *   **Cost Dashboard:** Create a simple view or script to visualize cost per generation/caption based on model usage (using token counts if logged/persisted).
    *   Iteratively refine `getCaptionGenerationTestPrompt` based on analysis.
    *   **Prompt Versioning:** Track changes to the prompt (e.g., simple version number in filename/function name, or store prompt text alongside test results) to correlate prompt changes with quality shifts.
    *   Document findings and select optimal model(s) and the final prompt version.

2.  **Refactor `AIMemeSelector.tsx` (behind Feature Flag):**
    *   Introduce an environment variable `NEXT_PUBLIC_ENABLE_NEW_CAPTION_FLOW=true/false`.
    *   Wrap the new logic paths in `AIMemeSelector.tsx` with checks for this flag.
    *   **Decision Point Revisit:** Decide whether to use Scenario A (AI selects + captions) or Scenario B (Separate selection & captioning), informed by analysis.
    *   **Implement Chosen Scenario:**
        *   Modify API calls to use the unified `/api/ai/chat` endpoint, passing the chosen model identifier and the finalized/versioned prompt.
        *   Ensure `stream: true` is passed if using streaming responses in the UI.
        *   Update response parsing and state management logic.
        *   Remove old API call logic within the feature-flagged code path.
    *   Update model selection UI if needed.

3.  **Refactor/Remove Old API Routes:**
    *   Once the new flow is stable and the feature flag is enabled by default (or removed), the old routes (`/api/openai/chat`, `/api/anthropic/...`) can be safely removed.

4.  **Consolidate Prompt Logic (Optional):**
    *   Review if the final prompt used in `AIMemeSelector.tsx` can be consolidated with the final testing prompt.

## Testing Points (Post-Refactor)

*   Test UI flow with feature flag OFF (should use old logic).
*   Test UI flow with feature flag ON:
    *   Verify correct model and prompt are used.
    *   Confirm caption quality aligns with expectations from analysis.
    *   Test streaming UI updates if applicable.
    *   Test error handling and loading states.
*   Verify cost/latency metrics (from observability/persisted data) for the user-facing flow match expectations.
*   After removing old routes, ensure no regressions occurred. 