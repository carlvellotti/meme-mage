# Tech Specs: Step 3 - Backend API Route (Gemini Pro 2.5)

## Objective

Create a dedicated Next.js API route to handle requests for video-based meme template analysis using the **Gemini 2.5 Pro (Preview 03-25)** model.

## Task

1.  **Create API Route File:**
    *   File Path: `src/app/api/analyze-video-template/route.ts`

2.  **Implement Route Handler:**
    *   Define an asynchronous `POST` function within `route.ts`.
    *   **Imports:**
        *   `GoogleGenerativeAI`, `HarmCategory`, `HarmBlockThreshold`, `GenerateContentRequest`, `InlineDataPart`, `FileDataPart` from `@google/generative-ai`
        *   `NextRequest`, `NextResponse` from `next/server`
        *   `getGeminiVideoAnalysisPrompt` from `@/lib/utils/prompts`
    *   **Constants:**
        *   `MODEL_NAME = "gemini-2.5-pro-preview-03-25"` (Final chosen model)
        *   `API_KEY = process.env.GOOGLE_API_KEY`
        *   `safetySettings` array (configure appropriate thresholds)
        *   `generationConfig` object (e.g., `{ temperature: 0.7, maxOutputTokens: 8000 }`) - Note the high `maxOutputTokens` needed for complete analysis from this model.
    *   **Logic:**
        *   Check if `API_KEY` is configured; return 500 error if not.
        *   Parse the JSON request body to extract `videoUrl` (string, required) and `exampleCaption` (string | null, optional).
        *   Perform basic validation: check for `videoUrl` presence and validate its format (e.g., using `new URL()`). Return 400 error on validation failure.
        *   Instantiate `GoogleGenerativeAI` with the `API_KEY`.
        *   Get the generative model instance using `genAI.getGenerativeModel()` with `MODEL_NAME`, `safetySettings`, and `generationConfig`.
        *   Fetch the video content from `videoUrl` and convert it to base64.
        *   Determine the video's MIME type based on the `videoUrl` file extension (heuristic, defaults to `video/mp4`).
        *   Generate the detailed analysis prompt using `getGeminiVideoAnalysisPrompt(exampleCaption)`. This prompt now includes the `exampleCaption` for analysis and asks for additional hypothetical examples.
        *   Construct the `parts` array for the `generateContent` call using the `inlineData` field:
            *   Part 1: `{ text: promptText }`
            *   Part 2: `{ inlineData: { mimeType: determinedMimeType, data: base64VideoData } }`
        *   Wrap the `model.generateContent()` call in a `try...catch` block for error handling.
        *   Log the start of the Gemini API call.
        *   Call `await model.generateContent({ contents: [{ role: "user", parts }] })`.
        *   **Response Handling:**
            *   Check for `result.response` and potential content blocking (`promptFeedback.blockReason`). Return appropriate errors if blocked or response is missing.
            *   Extract the generated text using `result.response.text()`.
            *   Log the successful retrieval and length of the analysis text.
            *   Check if the returned text is empty/null; log a warning if so.
            *   Return a JSON response using `NextResponse.json({ analysis: analysisText ?? '' }, { status: 200 })`.
        *   **Error Handling (Catch Block):**
            *   Log the detailed error.
            *   Return a generic error message to the client using `NextResponse.json({ error: "Video analysis failed. Please try again later." }, { status: 500 })`.

## Key Considerations

*   **Model:** Explicitly uses `gemini-2.5-pro-preview-03-25`. This model provides better analysis quality compared to Flash but requires a higher `maxOutputTokens` limit (e.g., 8000) to avoid truncation.
*   **Input:** Takes `videoUrl` (publicly accessible string) and `exampleCaption` (string | null).
*   **Output:** Returns `{ analysis: string }` on success, containing the detailed markdown analysis. Returns `{ error: string }` on failure.
*   **Frontend Integration (`04_Frontend_Integration.md`):** The frontend will call this endpoint when an unprocessed template is selected. It will send the `cropped_video_url` as `videoUrl` and `caption_text` as `exampleCaption`. The returned `analysis` string will be used to pre-populate the `initialExplanation` prop of the `TemplateUploader` component.
*   **Error Handling:** Includes checks for API key, input validation, content blocking, empty responses, and general API call failures.
*   **Dependencies:** Requires environment variables (`GOOGLE_API_KEY`), the `@google/generative-ai` SDK, and the updated `getGeminiVideoAnalysisPrompt` function.

## Outcome

*   A functional API endpoint `POST /api/analyze-video-template` is finalized.
*   This endpoint uses Gemini 2.5 Pro to receive a video URL and optional caption, interact with the model via inline data, and return detailed AI-generated analysis text suitable for pre-populating the template explanation field in the frontend.
*   Robust error handling and logging are implemented. 