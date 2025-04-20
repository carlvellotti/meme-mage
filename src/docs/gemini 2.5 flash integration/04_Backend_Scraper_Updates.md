# Tech Specs: Step 4 - Backend Scraper Updates

## Objective

Modify the Instagram Reel scraping process, primarily within the Python script (`src/lib/meme-scraper/process_reels.py`), to directly populate the main `meme_templates` table with AI-generated analysis and mark them as unreviewed (`reviewed = false`). This involves removing the script's reliance on `db_manager.py` and the old processing flow, replacing it with calls to Node.js helper APIs and direct insertion into `meme_templates` using `supabase-py`. The Node.js API route (`/api/scrape-reels`) will continue to invoke this Python script.

## Related Files

*   `src/lib/meme-scraper/process_reels.py` (Primary file to modify)
*   `src/lib/meme-scraper/db_manager.py` (Usage to be removed from `process_reels.py`)
*   `src/lib/meme-scraper/storage_uploader.py` (Existing usage for video upload remains)
*   `src/app/api/scrape-reels/route.ts` (Invokes the Python script, may need env var updates)
*   `src/app/api/analyze-video-template/route.ts` (To be called by the Python script)
*   `src/app/api/embeddings/route.ts` (To be called by the Python script)
*   `src/app/api/generate-thumbnail/route.ts` (To be called by the Python script)
*   Python libraries: `requests`, `supabase-py` (install required)

## Database Changes Required (Manual / Migration)

*   **Add `reviewed` column to `meme_templates` table:**
    *   `ALTER TABLE meme_templates ADD COLUMN reviewed BOOLEAN NULL DEFAULT NULL;`
    *   Note: The default is `NULL`, but the script will insert `FALSE`. Existing templates can remain `NULL` or be backfilled to `TRUE` if considered reviewed.

## Tasks (Modify `src/lib/meme-scraper/process_reels.py`)

1.  **Dependencies & Environment:** Add imports for `requests`, `supabase`, `os`, `shutil`. Ensure environment variables `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `NODE_API_BASE_URL` (e.g., `http://localhost:3000`) are available.
2.  **Remove Old DB Logic:** Delete all calls to functions from `db_manager.py` (`insert_pending_reel`, `update_template_urls`, `update_template_error`, `update_template_status`).
3.  **Initialize Supabase Client:** Create a Supabase client instance using `supabase.create_client()` with the URL and Service Role Key.
4.  **Modify `process_url` Loop:** For each URL:
    *   **Keep Existing Steps:** Download video (`downloader.py`), extract frame (`frame_extractor.py`), crop video (`video_cropper.py`), extract caption (`caption_extractor.py`). Retain `video_path`, `frame_path`, `cropped_video_path`, `caption_text`.
    *   **Upload Cropped Video:** Use existing `storage_uploader.py` logic to upload `cropped_video_path` to Supabase Storage -> Get `finalVideoUrl`. Handle errors.
    *   **Call Thumbnail API (Node.js):**
        *   `POST` request using `requests` to `{NODE_API_BASE_URL}/api/generate-thumbnail` with JSON body `{"videoUrl": finalVideoUrl}`.
        *   Parse response to get `thumbnailUrl`. Set to `None` on error.
    *   **Call Analysis API (Node.js):**
        *   `POST` request using `requests` to `{NODE_API_BASE_URL}/api/analyze-video-template` with JSON body `{"videoUrl": finalVideoUrl, "exampleCaption": caption_text}`.
        *   Parse response to get `analysis` and `suggestedName`. Set placeholders on error.
    *   **Call Embedding API (Node.js):**
        *   `POST` request using `requests` to `{NODE_API_BASE_URL}/api/embeddings` with JSON body `{"text": analysis}`.
        *   Parse response to get `embeddingVector`. Set to `None` on error.
    *   **Insert into `meme_templates` Table:**
        *   Use the initialized `supabase-py` client.
        *   Construct the data dictionary (including `name`, `video_url`, `poster_url=thumbnailUrl`, `instructions=analysis`, `instagram_url`, `embedding=embeddingVector`, `reviewed=False`, `uploader_name='Scraper'`).
        *   Call `supabase.table('meme_templates').insert(data_dict).execute()`.
        *   Handle potential `supabase.errors.APIError` during insertion.
    *   **Enhanced Cleanup:**
        *   Remove temporary files: `os.remove(file_path)` for `video_path`, `frame_path`, `cropped_video_path` if they exist.
        *   Remove potential temporary directories: `shutil.rmtree(dir_path, ignore_errors=True)` for likely paths like `./captions/` and `./frames/debug/` (relative to script execution).
    *   Return `True` on success, `False` on failure.
5.  **Script Output:** Ensure `main` function logs overall success/failure counts based on `process_url` results.

## Key Considerations

*   **API Base URL:** Pass `NODE_API_BASE_URL` via environment variable. `/api/scrape-reels/route.ts` may need modification to pass this when spawning the process.
*   **Python Dependencies:** Ensure `requests` and `supabase-py` are installed (`pip install requests supabase-py`).
*   **Error Handling:** Implement `try...except` blocks for file operations, API calls (`requests.exceptions.RequestException`), and Supabase insert (`supabase.errors.APIError`).
*   **Helper Script Outputs:** Assume helper scripts (`downloader`, `cropper`, etc.) create outputs in the current working directory or known relative paths for cleanup.
*   **Authentication/Authorization:** As before, Node.js endpoints should be protected if needed. `/api/scrape-reels` should be protected.
*   **Performance:** As before.

## Outcome

*   Python script `process_reels.py` directly scrapes, analyzes (via API calls), and stores templates in `meme_templates` with `reviewed=False`.
*   Removes dependency on the old `db_manager.py` flow.
*   Includes API calls for thumbnail generation.
*   Implements more robust cleanup of temporary files and directories.
*   The `unprocessed_templates` table is unused by this process.

---

## Change Log & Complexity Note

*   **Shifted Focus:** Implementation focus moved from the Node.js `/api/scrape-reels` route to the Python script `src/lib/meme-scraper/process_reels.py`.
*   **Added Thumbnail Step:** Explicitly added the requirement for the Python script to call `/api/generate-thumbnail`.
*   **Corrected Table Name:** Updated `templates` to `meme_templates`.
*   **Clarified `reviewed` Default:** Noted the SQL default is `NULL`, but the script inserts `False`.
*   **Added API Calls:** Specified the HTTP POST requests the Python script needs to make to the Node.js backend for thumbnail, analysis, and embedding generation.
*   **Python DB Client:** Specified the need for a Python Supabase client (`supabase-py`) for the database insertion step.
*   **Detailed Python Logic:** Incorporated understanding from `process_reels.py` review, including removal of `db_manager.py` usage and specifying interaction with `storage_uploader.py`.
*   **Enhanced Cleanup:** Added requirement to clean up potential directories like `captions` and `frames/debug`.

**Complexity Note:** This approach, while leveraging the existing Python scraper, introduces complexity by requiring communication between the Python script and multiple Node.js API endpoints. This increases potential points of failure (network errors, API availability) and requires managing dependencies and environment configurations in both Python and Node.js contexts.

**Future Refactoring:** If this inter-process communication becomes problematic or difficult to manage, a future refactoring could involve:
    1.  Rewriting the scraping logic entirely within Node.js/TypeScript, eliminating the Python dependency.
    2.  Modifying the Python script to only perform scraping and return structured data (video path/URL, caption) to the Node.js route, which would then handle the API calls and database insertion using native JS libraries. This retains the Python scraper but centralizes the processing logic. 