# Tech Specs: Step 4 - Backend Scraper Updates

## Objective

Modify the Instagram Reel scraping process (`/api/scrape-reels`) to directly populate the main `templates` table with AI-generated analysis and mark them as unreviewed.

## Related Files

*   `src/app/api/scrape-reels/route.ts` (Primary file to modify)
*   `src/app/api/analyze-video-template/route.ts` (To be called by the scraper)
*   `src/lib/supabase/admin.ts` or equivalent (For database interactions)
*   `src/lib/utils/embeddingUtils.ts` (Assuming embedding logic exists here or needs creation)

## Database Changes Required (Manual / Migration)

*   **Add `reviewed` column to `templates` table:**
    *   `ALTER TABLE templates ADD COLUMN reviewed BOOLEAN NULL DEFAULT FALSE;`
    *   Existing templates can remain NULL or be backfilled to TRUE if considered reviewed.

## Tasks (`/api/scrape-reels` Backend)

1.  **Modify Input Handling:** No changes needed, still accepts `{ urls: string[] }`.

2.  **Iterate Through URLs:** For each valid Instagram Reel URL:
    *   Perform existing scraping logic to get video (likely involves downloading, potentially cropping if still needed).
    *   Extract the `caption_text` from the Reel metadata.
    *   Store the final public video URL (e.g., Supabase Storage URL).
    *   **Generate Poster:** Ensure poster/thumbnail generation still occurs and the `poster_url` is obtained.

3.  **Call Analysis API:**
    *   After obtaining the video URL and `caption_text`:
    *   Make a `POST` request to `http://localhost:3000/api/analyze-video-template` (or use an internal function call if refactored).
    *   **Body:** Send `{ videoUrl: finalVideoUrl, exampleCaption: caption_text }`.
    *   Handle the response: `const { analysis, suggestedName } = await analysisResponse.json();`.
    *   **Error Handling:** If the analysis API call fails:
        *   Log the error.
        *   Set `analysis` to an empty string (`''`) or a placeholder like `"Analysis failed."`. 
        *   Set `suggestedName` to a placeholder derived from the URL or caption (e.g., `"Untitled Template - ${Date.now()}"`).

4.  **Generate Embedding:**
    *   Use the obtained `analysis` string (even if empty/placeholder) as the input text.
    *   Call the embedding generation function (e.g., using OpenAI's API via Supabase Edge Functions or directly).
    *   Obtain the resulting embedding vector.
    *   **Error Handling:** If embedding generation fails, log the error and set the embedding to `null` or handle according to DB schema constraints.

5.  **Insert into `templates` Table:**
    *   Construct the data object for the new template record:
        *   `name`: Use `suggestedName` from analysis API response (or placeholder).
        *   `video_url`: `finalVideoUrl`.
        *   `poster_url`: Generated `poster_url`.
        *   `instructions`: Use `analysis` from analysis API response (or placeholder).
        *   `instagram_url`: The original input Reel URL.
        *   `embedding`: The generated embedding vector (or null).
        *   `reviewed`: `FALSE`.
        *   `uploader_name`: Set appropriately (e.g., "Scraper", or potentially track user if scraping is user-initiated).
    *   Use the Supabase admin client (or equivalent) to insert this record into the `templates` table.
    *   Handle potential database insertion errors.

6.  **Response:** Modify the overall response of the `/api/scrape-reels` endpoint to reflect the outcome (e.g., number successfully processed and added for review).

## Key Considerations

*   **Embedding Logic Location:** The function to generate embeddings needs to be accessible from the `/api/scrape-reels` backend context.
*   **Error Robustness:** The process should be robust to failures in individual steps (scraping, analysis, embedding, DB insert) for each URL, ideally logging errors and continuing with the next URL.
*   **Authentication/Authorization:** Ensure the scraping endpoint has appropriate security if it's user-facing.
*   **Performance:** Processing multiple Reels, including analysis and embedding, might take time. Consider background jobs (e.g., Vercel Cron Jobs, Supabase Edge Functions with queues) for large batches if performance becomes an issue.

## Outcome

*   The `/api/scrape-reels` endpoint now directly creates new entries in the main `templates` table.
*   These new templates are marked as `reviewed = false`.
*   They have AI-generated names and instructions (or placeholders on error).
*   They have corresponding embeddings generated based on the AI instructions.
*   The `unprocessed_templates` table is no longer used by this process. 