# Reels Scraper Integration: Chunk 2 - Storage Integration & File Processing

## 1. Goals (Achieved)

*   Create Supabase Storage buckets for unprocessed videos and thumbnails.
*   Modify the Python scraper to upload processed files to Supabase Storage.
*   Update the database records with file URLs and metadata using `supabase-py`.
*   Ensure proper status tracking throughout the processing workflow.

## 2. Technical Implementation (Completed)

### 2.1. Supabase Storage Setup

*   **Storage Buckets Created:**
    *   `unprocessed-videos` bucket created for cropped videos.
    *   `unprocessed-thumbnails` bucket created for extracted frames (thumbnails).
    *   Configured public read access for both buckets to allow frontend display via generated URLs.
*   **RLS Policies:** Basic policies allowing public read access were confirmed or configured via Supabase UI/SQL.

### 2.2. Python Scraper Storage & DB Integration

*   **Installed Python Dependencies:**
    *   Added and installed the following to `requirements.txt` in the `.venv` environment:
        *   `httpx==0.24.1` (for `storage_uploader.py`)
        *   `python-magic==0.4.27` (for MIME type detection)
        *   `supabase` (Supabase Python client library for DB operations)
        *   `python-dotenv` (for loading `.env.local` during direct script execution/testing)
*   **Created Python Upload Helper (`storage_uploader.py`):**
    *   Implemented `StorageUploader` class using `httpx` to upload files to Supabase Storage.
    *   Handles MIME type detection using `python-magic`.
    *   Generates unique filenames based on Instagram ID.
    *   Reads Supabase URL and Service Key from environment variables.
    *   Updated to check for both `SUPABASE_SERVICE_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
*   **Refactored `db_manager.py` to use `supabase-py`:**
    *   Removed old `psycopg2` connection logic and `DatabaseManager` class.
    *   Initialized `supabase-py` client at module level using `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_KEY`/`SUPABASE_SERVICE_ROLE_KEY`.
    *   Rewritten `insert_pending_reel`, `update_template_urls`, `update_template_status`, `update_template_error` functions to use `supabase.table()...execute()` methods.
*   **Modified `process_reels.py` to Use Storage Upload & New DB Manager:**
    *   Imported and used `StorageUploader` (instantiated *within* `process_url` function, fixing an earlier argument mismatch).
    *   Called refactored `db_manager` functions (using `supabase-py`) for creating the initial record and updating status, URLs, caption, and errors.
    *   Included calls to `extract_instagram_id` for unique file naming.
    *   Ensured `cleanup_files` is called reliably using a `finally` block.

### 2.3. Error Handling Enhancements

*   Added `try...except` blocks around major processing steps (download, extract, crop, upload, DB update) within `process_url`.
*   Used `db_manager.update_template_error` to record specific error messages and set status to `failed` in the database upon encountering exceptions.
*   `StorageUploader` returns success status and error messages, which are checked in `process_reels.py`.
*   Client initialization in `db_manager` includes error logging.

## 3. Testing (Completed)

*   **Unit/Component Tests:**
    *   `test_env.py`: Verified environment variable presence and basic module imports.
    *   `test_db.py`: Initially created to test `psycopg2`, refactored alongside `db_manager.py` or verified via `test_integration.py` and direct `db_manager.py` execution checks.
    *   `test_storage.py`: Verified `StorageUploader` functionality (authentication, MIME types, uploads, URL generation).
*   **Integration Test (`test_integration.py`):**
    *   Created to run the core `process_url` function end-to-end.
    *   Updated to load `.env.local` correctly using `python-dotenv`.
    *   Updated helper functions (`find_template_id_by_url`, `cleanup_test_record`) to use `supabase-py`.
    *   Successfully executed, verifying database interaction and workflow logic, but required commenting out cleanup for manual inspection.
*   **Direct Script Execution (`process_reels.py`):**
    *   Successfully executed multiple times with different URLs (`DIbYpKHR3xj`, `DIW7ZoNT0fn`, `DITV5E5xM8G`).
    *   Confirmed creation/update of records in `unprocessed_templates` table with `status='completed'`, correct URLs, and captions.
    *   Validated that running the main script leaves the final records in the database (unlike the test script's default cleanup).
*   **DELETE API Route (`/api/unprocessed-templates/[id]/route.ts`):**
    *   Created the `DELETE` handler using the server-side Supabase client.
    *   Tested using `curl` with an existing ID, received `204 No Content`.
    *   Tested again with the same ID, received `404 Not Found`.
    *   Confirmed the API route successfully deletes records from `unprocessed_templates`.

## 4. Chunk 2 Implementation Notes & Key Decisions

*   **System Dependency (`libmagic`):** The `python-magic` library required the underlying `libmagic` system library to be installed (e.g., via `brew install libmagic` on macOS). This is crucial for the execution environment (local dev, Docker, Vercel function potentially). 
*   **Environment Variable Loading:** Running Python scripts directly required explicitly loading variables from `.env.local`. The `python-dotenv` library was added to `requirements.txt` and used in test scripts to achieve this. The `db_manager.py` refactor ensured client initialization happened *after* dotenv loading in test scripts.
*   **Supabase Key Ambiguity:** Both `SUPABASE_SERVICE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` were present in `.env.local`. Updated `storage_uploader.py` and `db_manager.py` to check for either, prioritizing the service role key for backend operations.
*   **Database Connection Method:** Direct connection attempts using `psycopg2` and `SUPABASE_DB_URL` failed due to Supabase network policies. **Refactored `db_manager.py` to use the `supabase-py` client library**, which interacts with the database via the allowed Supabase REST API.
*   **Storage Upload Duplicates:** Initial integration testing failed due to duplicate files already existing in storage from previous runs. The test script cleanup only removed DB records. Running the main `process_reels.py` script (which doesn't clean storage) highlighted this. Supabase Storage defaults to rejecting uploads if the exact path/filename already exists.
*   **`process_url` Argument Fix:** Corrected `process_reels.py` by instantiating `StorageUploader` *inside* the `process_url` function instead of requiring it as an argument, resolving a `TypeError` during testing.
*   **Successful End-to-End Validation:** Direct runs of `process_reels.py` confirmed the entire pipeline works correctly for new URLs, leaving the final results in the database and storage as expected.
*   **DELETE API Route Creation:** Although technically part of the frontend workflow logic, the `/api/unprocessed-templates/[id]` DELETE route was created and tested during this phase to ensure all necessary backend functionality was in place.

## 5. Remaining Considerations / Next Steps Prep

*   **Storage Cleanup Strategy:** Need a strategy for handling files in Supabase Storage (e.g., when an `unprocessed_template` DB record is deleted by the frontend later, should the corresponding files in storage also be deleted?).
*   **Error Handling Granularity:** While errors are logged to the DB, the frontend might need more user-friendly feedback than just seeing a 'failed' status.
*   **API Route Environment:** Ensure the Vercel deployment environment for the `/api/scrape-reels` route has Python, necessary system dependencies (like `libmagic`, `ffmpeg`), and the Python packages from `requirements.txt` available.
*   **Security:** The API route (`/api/scrape-reels/route.ts`) still needs proper authentication checks added to prevent unauthorized use. 