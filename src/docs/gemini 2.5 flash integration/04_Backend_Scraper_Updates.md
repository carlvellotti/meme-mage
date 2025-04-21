# Tech Specs: Step 4 - Backend Scraper Updates

## Objective

Modify the Instagram Reel scraping process to use a two-stage approach:
1.  The Python script (`src/lib/meme-scraper/process_reels.py`) handles scraping, local file processing (download, crop, caption), and uploading the final video to Supabase storage. It then outputs structured JSON results (video URL, caption, etc.) or errors to standard output.
2.  The Node.js API route (`/api/scrape-reels/route.ts`) invokes the Python script, parses its JSON output, and then orchestrates the remaining steps within Node.js: calling helper APIs (thumbnail, analysis, embedding) and inserting the final data into the `meme_templates` table with `reviewed = false` using the `supabaseAdmin` client.

This approach centralizes the AI and database logic within the Node.js application while leveraging the existing Python script for the initial scraping and file handling.

## Related Files

*   `src/lib/meme-scraper/process_reels.py` (Modified to output JSON)
*   `src/lib/meme-scraper/storage_uploader.py` (Modified to use final bucket)
*   `src/app/api/scrape-reels/route.ts` (Modified to parse Python output and perform API calls/DB insert)
*   `src/app/api/analyze-video-template/route.ts` (Called by Node.js route, updated to parse name/analysis)
*   `src/app/api/embeddings/route.ts` (Called by Node.js route)
*   `src/app/api/generate-thumbnail/route.ts` (Called by Node.js route)
*   `src/lib/utils/prompts.ts` (Modified analysis prompt)
*   `src/lib/supabase/admin.ts` (Used by Node.js route for DB insert)
*   `src/lib/utils/embeddings.ts` (Used by Node.js route)
*   Python libraries: `json`, `shutil` (standard library), plus existing helpers.

## Database Changes Required (Manual / Migration)

*   **Add `reviewed` column to `meme_templates` table:**
    *   `ALTER TABLE meme_templates ADD COLUMN reviewed BOOLEAN NULL DEFAULT NULL;`
    *   Note: The default is `NULL`, but the Node.js route inserts `FALSE`.

## Tasks (Refactored Implementation)

**1. Python Script (`src/lib/meme-scraper/process_reels.py`):**
    *   Remove imports and usage of `requests` and `supabase-py`.
    *   Remove calls related to the old `db_manager.py`.
    *   Keep logic for downloading, frame extraction, cropping, caption extraction.
    *   Ensure `storage_uploader.py` uploads the final video to the `meme-templates` bucket.
    *   On success for a URL, `print` a JSON string to `stdout` containing: `{ "success": true, "finalVideoUrl": "...", "captionText": "...", "instagramId": "...", "originalUrl": "..." }`.
    *   On failure at any step for a URL, `print` a JSON string to `stdout` containing: `{ "success": false, "error": "...", "originalUrl": "..." }`.
    *   Implement robust cleanup of temporary local files and directories (e.g., `./captions`, `./frames/debug`).

**2. Node.js Route (`/api/scrape-reels/route.ts`):**
    *   Spawn the modified Python script with the input URLs.
    *   Capture `stdout` from the Python script.
    *   On Python script completion (`on('close')`):
        *   Check exit code. If non-zero, mark all URLs for this batch as failed.
        *   If exit code is zero, parse each line of `stdout` expecting a JSON object.
        *   For each successfully parsed JSON result from Python where `success` is `true`:
            *   Extract `finalVideoUrl`, `captionText`, `instagramId`, `originalUrl`.
            *   Call `/api/generate-thumbnail` using `fetch` to get `posterUrl`.
            *   Call `/api/analyze-video-template` using `fetch` to get `analysis` and `suggestedName`.
            *   Call `generateEmbedding(analysis)` utility function to get `embeddingVector`.
            *   Use `supabaseAdmin` client to `insert` into `meme_templates` table with all collected data, setting `reviewed: false` and `uploader_name: 'Scraper'`. Handle potential insert errors.
        *   For URLs that failed in Python (`success: false`) or during Node.js processing (API/DB errors), record the error status.
    *   Return a final JSON response containing an array of results, detailing the status (`success`, `python_error`, `processing_error`, `db_error`) for each original input URL.

**3. Supporting Files:**
    *   Ensure `/api/analyze-video-template/route.ts` correctly parses the AI response based on the updated prompt (extracting `suggestedName` and `analysis`).
    *   Ensure `src/lib/utils/prompts.ts` contains the updated `getGeminiVideoAnalysisPrompt` instructing the AI on name formatting and avoiding preamble.

## Key Considerations

*   **JSON Parsing:** The Node.js route needs robust parsing of the JSON output from Python stdout.
*   **Error Handling:** Implement comprehensive error handling in the Node.js route for Python script failures, JSON parsing errors, API call failures (`fetch`), embedding generation errors, and database insertion errors (`supabaseAdmin`).
*   **Environment Variables:** Node.js environment needs Supabase and Google AI keys. Python script primarily needs Supabase keys for the `storage_uploader`.
*   **Helper Script Outputs:** Python script relies on helper scripts (`downloader`, `cropper`, etc.) working correctly and cleaning up after themselves or placing files predictably for the main script's cleanup.
*   **Authentication/Authorization:** Secure the `/api/scrape-reels` endpoint.
*   **Performance:** Processing happens sequentially per URL within the Node.js route after the Python script finishes. Consider async processing (`Promise.all`) within the Node.js loop if performance for large batches becomes critical.

## Outcome

*   Scraping and initial file processing are handled by the Python script.
*   AI analysis, embedding, thumbnail generation, and final database insertion are centralized in the Node.js `/api/scrape-reels` route.
*   New templates are created in the `meme_templates` table with `reviewed = false`.
*   The `unprocessed_templates` table is unused by this process.
*   Reduced complexity by eliminating Python-to-Node.js API calls and Python database interactions.

---

## Change Log & Complexity Note

*   **Pivoted Approach:** Shifted from modifying Python to call Node.js APIs back to a model where Python returns data to Node.js for processing, aligning with the original 'Future Refactoring' note.
*   **Python Output:** Modified Python script to output structured JSON instead of performing API calls/DB inserts.
*   **Node.js Logic:** Added logic to `/api/scrape-reels` to parse Python output, call helper APIs (thumbnail, analysis, embedding), and perform the final database insert.
*   **Prompt/Parsing Update:** Modified the analysis prompt and corresponding API route (`/api/analyze-video-template`) to handle name extraction and remove preamble.
*   **Corrected Bucket/Column Names:** Updated Python's `storage_uploader` to use the correct bucket and Node.js DB insert to use the correct column name (`original_source_url`).
*   **Enhanced Cleanup:** Included robust cleanup in Python.

**Complexity Note:** This refactored approach reduces cross-language dependencies during runtime compared to the intermediate plan. It centralizes complex logic (AI interactions, DB writes) in the main Node.js application, which is generally preferred for maintainability. The main complexity lies in managing the two-stage process (Python -> Node.js) and robustly handling potential errors at each stage. 