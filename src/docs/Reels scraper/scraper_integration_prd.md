# Product Requirements Document: Instagram Reels Scraper Integration

## 1. Overview

Integrate the existing Python-based Instagram Reels scraper (`meme-scraper copy/`) into the Meme Mage application. This feature will allow users to input Instagram Reel URLs, process them using the scraper backend, store the results as "unprocessed templates," display these templates in a table, and select one to populate the main `TemplateUploader` component for finalization and storage as a usable meme template.

## 2. Goals

*   Enable users to easily import potential meme templates directly from Instagram Reels URLs.
*   Streamline the template creation workflow by pre-processing videos and extracting captions.
*   Leverage the existing intelligent cropping and caption extraction capabilities of the Python scraper.
*   Provide a manageable queue of unprocessed templates for review and finalization.
*   Maintain separation between raw scraped data and finalized, user-approved meme templates.

## 3. User Stories

*   **As a Template Curator:** I want to paste a list of Instagram Reel URLs into a form so that the system can download and process them automatically.
*   **As a Template Curator:** I want to see a list of successfully processed Reels, including a thumbnail, extracted caption, and the original URL, so I can review potential templates.
*   **As a Template Curator:** I want to select a processed Reel from the list and have its video and caption automatically loaded into the main Template Uploader form, so I can quickly add final details and save it.
*   **As a Template Curator:** I want processed Reels that I save as final templates to be removed from the unprocessed list, so I don't process them again.
*   **As an Administrator:** I want the scraping process to run on the backend without blocking the user interface.
*   **As an Administrator:** I want errors during the scraping process to be logged and potentially surfaced to the user, so issues can be diagnosed.

## 4. Functional Requirements

### 4.1. Frontend (React Components & Page Logic)

*   **Reel Input Component (`ReelScraperForm.tsx`):**
    *   Located below the `TemplateUploader` component on the relevant page.
    *   Contains a `<textarea>` field for pasting multiple Instagram Reel URLs, one per line.
    *   Contains a "Process Reels" button.
    *   Button click triggers a POST request to the `/api/scrape-reels` endpoint with the list of URLs.
    *   Displays loading state while the backend processes the URLs.
    *   Displays success or error messages based on the API response.
    *   Clears the textarea upon successful initiation of processing.
*   **Unprocessed Templates Table Component (`UnprocessedTemplatesTable.tsx`):**
    *   Located below the `ReelScraperForm`.
    *   Fetches data from the `unprocessed_templates` Supabase table.
    *   Displays data in a table format with columns:
        *   Thumbnail (Image fetched from `thumbnail_url`).
        *   Caption (`caption_text`).
        *   Instagram URL (`instagram_url`).
        *   Action Button ("Use Template").
    *   Includes pagination if the list becomes long.
    *   Provides a mechanism to refresh the table data (e.g., after processing is complete).
*   **Page Integration (e.g., `src/app/admin/templates/page.tsx`):**
    *   Renders `TemplateUploader`, `ReelScraperForm`, and `UnprocessedTemplatesTable` in sequence.
    *   Manages state related to the selected unprocessed template.
    *   Handles the "Use Template" button click:
        *   Retrieves the data (`cropped_video_url`, `caption_text`, `id`) for the selected row.
        *   Passes the `cropped_video_url` and `caption_text` as props/state to `TemplateUploader`.
        *   Stores the `id` of the selected unprocessed template for later deletion.
    *   Triggers a refresh of the `UnprocessedTemplatesTable` when the `/api/scrape-reels` processing potentially completes or when a template is finalized.
*   **Template Uploader Modification (`TemplateUploader.tsx`):**
    *   Accept new props (e.g., `initialVideoUrl`, `initialExplanation`, `unprocessedTemplateId`).
    *   When these props are set (due to selection from the table):
        *   Set the video preview using `initialVideoUrl` (needs to handle URL source, potentially fetching blob if `File` object is strictly needed, or just using the URL for preview).
        *   Set the `templateExplanation` state with `initialExplanation`.
    *   Modify `handleSubmit`:
        *   After successful insertion into `meme_templates`, if `unprocessedTemplateId` is present, make a call to Supabase to delete the corresponding row from `unprocessed_templates`.
        *   Clear the `unprocessedTemplateId` state after successful submission/deletion.

### 4.2. Backend (Next.js API Route)

*   **Scraper API Endpoint (`/api/scrape-reels/route.ts`):**
    *   Handles POST requests.
    *   Accepts `urls: string[]` in the JSON request body.
    *   Validates the input URLs (basic format check).
    *   Executes the `process_reels.py` Python script using Node.js `child_process.spawn`.
        *   Passes the list of URLs as command-line arguments to the script.
        *   Injects necessary environment variables (Supabase URL, Service Key, Google Cloud Vision API Key) into the Python script's execution environment.
    *   The endpoint should respond quickly to the client indicating that processing has started (asynchronous operation). *Consideration: How to notify the client upon completion? (e.g., WebSockets, polling, server-sent events, or just require manual refresh)*.
    *   Logs the stdout and stderr from the Python script for debugging.
    *   Handles potential errors during script execution (e.g., script not found, Python errors).

### 4.3. Python Scraper (`meme-scraper copy/`)

*   **Database Connection (`db_manager.py` or equivalent):**
    *   Modify to read Supabase connection details (DSN or individual parameters) from environment variables.
    *   Connect to the Supabase PostgreSQL database using `psycopg2`.
*   **Data Storage (`store_memes.py` or `process_reels.py`):**
    *   Modify the insertion logic to write to the `unprocessed_templates` table in Supabase.
    *   Store the correct data according to the new table schema (see 4.4).
*   **File Handling (`downloader.py`, `frame_extractor.py`, `video_cropper.py`, `process_reels.py`):**
    *   Modify `frame_extractor.py` to save the representative frame.
    *   Modify `process_reels.py` (or relevant functions) to:
        *   Upload the *cropped video* to a Supabase Storage bucket (e.g., `unprocessed-videos`).
        *   Upload the *extracted frame* (thumbnail) to a Supabase Storage bucket (e.g., `unprocessed-thumbnails`).
        *   Store the public URLs returned by Supabase Storage in the `unprocessed_templates` table (`cropped_video_url`, `thumbnail_url`).
    *   Ensure temporary local files created during processing are cleaned up.
*   **Input Handling (`process_reels.py`):**
    *   Ensure the script correctly parses multiple URLs passed as command-line arguments.
*   **Dependency Management (`requirements.txt`):**
    *   Ensure `psycopg2-binary` (or `psycopg2`) is included for Supabase connection.
    *   Add `supabase-py` or equivalent Python library if direct Supabase Storage interaction is preferred over presigned URLs or edge functions. (Alternatively, handle uploads via a separate API call from the Python script if direct Supabase lib usage is complex). *Decision needed on upload method.*

### 4.4. Database (Supabase)

*   **New Table (`unprocessed_templates`):**
    *   `id`: `uuid` (Primary Key, default `gen_random_uuid()`)
    *   `instagram_url`: `text` (Not Null)
    *   `caption_text`: `text` (Nullable)
    *   `cropped_video_url`: `text` (Nullable, URL to Supabase Storage)
    *   `thumbnail_url`: `text` (Nullable, URL to Supabase Storage)
    *   `status`: `text` (Default `'pending'`, e.g., 'processing', 'completed', 'failed')
    *   `error_message`: `text` (Nullable)
    *   `created_at`: `timestamp with time zone` (Default `now()`)
*   **Storage Buckets:**
    *   Create `unprocessed-videos` bucket (public or private with appropriate policies).
    *   Create `unprocessed-thumbnails` bucket (public read access likely needed).
*   **RLS Policies:** Configure appropriate Row Level Security policies for the `unprocessed_templates` table and Storage buckets.

## 5. Non-Functional Requirements

*   **Performance:** The scraping process for a single Reel should ideally complete within a reasonable timeframe (e.g., < 1-2 minutes). The API route should respond immediately to the user. The table loading should be fast.
*   **Scalability:** The system should handle a moderate number of concurrent scraping requests (consider implications for Python process execution and resource limits if running serverlessly).
*   **Error Handling:**
    *   Graceful handling of invalid Instagram URLs.
    *   Robust error catching within the Python script (download failures, processing errors, API errors). Errors should be logged to the `error_message` field in `unprocessed_templates`.
    *   Clear error feedback to the user on the frontend if the API call fails or if processing fails for specific URLs.
*   **Security:**
    *   API keys and Supabase credentials must not be exposed on the client-side. Use environment variables securely passed to the API route and the Python script.
    *   Protect the `/api/scrape-reels` endpoint (e.g., require authentication).
    *   Implement appropriate RLS policies in Supabase.
*   **Maintainability:** Python script modifications should be clean and well-documented. Frontend components should be modular and reusable.

## 6. Open Questions/Assumptions

*   **Python Execution Environment:** Where will the Python script run? Locally during development? In a Docker container? On a serverless function (e.g., Vercel Serverless Function with Python runtime, AWS Lambda)? This impacts dependency installation (esp. FFmpeg) and execution method. *Assumption: Environment capable of running Python 3.7+ with specified dependencies and FFmpeg.*
*   **Notification on Completion:** How will the frontend know when the asynchronous scraping process is finished to refresh the table? (Polling, WebSockets, manual refresh?) *Assumption: Manual refresh initially, or simple polling.*
*   **Resource Cleanup:** Define the strategy for cleaning up video/thumbnail files from Supabase Storage if an unprocessed template is never finalized or if deletion fails.
*   **Google Cloud Vision API Key:** How is this key managed and passed securely to the Python script? *Assumption: Via secure environment variable.*
*   **Rate Limiting:** Consider potential rate limits from Instagram, Google Cloud Vision, and Supabase.
*   **yt-dlp Updates:** `yt-dlp` needs frequent updates to keep working with platform changes. How will this be managed in the deployment environment?

## 7. Out of Scope (Optional - for initial implementation)

*   Real-time progress updates during scraping.
*   Automatic retries for failed scraping attempts.
*   User interface for managing/viewing scraper logs directly.
*   Batch deletion or editing of unprocessed templates.
*   Advanced status tracking beyond 'pending'/'processing'/'completed'/'failed'.