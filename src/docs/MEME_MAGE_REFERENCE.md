# Meme Mage Feature Reference

This document outlines the key features and technical details of the Meme Mage functionality.

## Feature: Meme Categories

**Goal:** To allow administrators to assign categories to meme templates during the review process and enable users to filter meme template selections by these categories.

**Core Components & Flow:**

1.  **Database Schema (`meme_templates` table):**
    *   The `meme_templates` table stores all information about individual meme templates. Key fields include:
        *   `id UUID PRIMARY KEY`
        *   `name TEXT`
        *   `video_url TEXT` (URL to the processed video file)
        *   `poster_url TEXT NULLABLE` (URL to a thumbnail/poster image)
        *   `instructions TEXT NULLABLE` (AI-generated analysis/description of the template)
        *   `original_source_url TEXT NULLABLE` (The original URL the video was scraped from)
        *   `embedding VECTOR(1536) NULLABLE` (Vector embedding of the `instructions` for semantic search. Adjust dimension as per your model.)
        *   `is_greenscreen BOOLEAN DEFAULT FALSE` (True if the template is a greenscreen video, affecting processing and analysis)
        *   `category TEXT NULLABLE` (User-defined category for filtering, e.g., "Gym")
        *   `scraped_example_caption TEXT NULLABLE` (Captions provided by user during greenscreen scraping, or captions extracted by AI for standard videos)
        *   `reviewed BOOLEAN DEFAULT FALSE`
        *   `uploader_name TEXT NULLABLE` (e.g., 'Scraper', 'Admin')
        *   (Other standard timestamp fields like `created_at`, `updated_at`)
    *   For the category feature, the `category` column was added via:
        ```sql
        ALTER TABLE public.meme_templates
        ADD COLUMN IF NOT EXISTS category TEXT NULL;
        ```
    *   The `is_greenscreen` column is crucial for the video scraper and template selection logic.

2.  **TypeScript Type Definition (`src/lib/supabase/types.ts`):**
    *   The `MemeTemplate` interface reflects the database schema:
        ```typescript
        export interface MemeTemplate {
          id: string;
          name: string | null;
          video_url: string | null;
          poster_url?: string | null;
          instructions?: string | null;
          original_source_url?: string | null;
          embedding?: number[] | null; // Or string if your library handles it as such before conversion
          is_greenscreen?: boolean | null;
          category?: string | null;
          scraped_example_caption?: string | null;
          reviewed?: boolean | null;
          uploader_name?: string | null;
          // ... other fields
        }
        ```

3.  **Admin Review & Category Assignment (`src/app/components/ReviewTemplatesTable.tsx`):**
    *   **UI Change:** A "Category" column was added to the unreviewed templates table. Each row in this column contains a dropdown menu.
    *   **Dropdown Options:**
        *   "None" (default, representing no category or `NULL` in the database).
        *   Predefined categories (initially: "Gym"). This list (`AVAILABLE_CATEGORIES`) is currently defined within the component.
    *   **State Management:** A `pendingCategoryUpdates: Record<string, string | null>` state variable was introduced to temporarily store the category selected in a dropdown for a specific template *before* it's officially approved.
    *   **Saving Logic:**
        *   The category for a template is **only saved to the database when an administrator clicks the "Approve" or "Save & Approve" button** for that template.
        *   The `handleApproveOnly` function was modified:
            *   It retrieves the selected category for the template ID from `pendingCategoryUpdates`. If no selection was made in the current session for that template, it uses the template's existing `category` value.
            *   The determined category (or `null` if "None" was selected/no category) is included in the `PATCH` request payload to `/api/templates/[id]`, alongside `reviewed: true`.
        *   The previous functionality of saving the category immediately on dropdown change (`handleCategoryChange`) was removed.

4.  **User Meme Selection (`src/app/components/MemeSelectorV2.tsx`):**
    *   **UI Change:** A "Meme Category (Optional)" dropdown filter was added to the meme selection form.
    *   **Dropdown Options:**
        *   "Any Category" (default).
        *   Specific categories available (initially: "Gym"). This list is currently hardcoded in the component but should ideally be shared with `ReviewTemplatesTable.tsx`.
    *   **State Management:** A `selectedCategory: string` state variable holds the user's choice from this dropdown. This selection is also persisted to `localStorage`.
    *   **API Interaction:**
        *   In the `handleSubmit` function, if a category is selected (i.e., `selectedCategory` is not an empty string), its value is included in the request body sent to the `POST /api/templates/select` endpoint (e.g., `category: selectedCategory || undefined`).

5.  **Backend API Route Modifications:**
    *   **`PATCH /api/templates/[id]/route.ts` (Update/Approve Template):**
        *   The route handler now expects an optional `category` field in the JSON request body.
        *   Input validation was added for the `category` field (must be a string or `null` if provided).
        *   If `category` is provided, it's included in the `updateData` object that is sent to `supabaseAdmin.from('meme_templates').update(...)`. This allows saving or clearing the category for a template.
    *   **`POST /api/templates/select/route.ts` (Select Templates for User):**
        *   The Zod validation schema (`TemplateSelectSchema`) was updated to include `category: z.string().optional().nullable()`.
        *   The `category` value is extracted from the validated request body.
        *   This `category` value is then passed as a parameter (e.g., `filter_category` or `filter_category_param`) to the appropriate Supabase RPC function (`match_meme_templates` or `get_random_meme_templates`).

6.  **Supabase RPC Function Updates:**
    *   **New Parameter:** Both functions were updated to accept a new optional parameter: `filter_category TEXT DEFAULT NULL`.
    *   **SQL Logic:** The `WHERE` clause in both functions was modified to include:
        ```sql
        AND (filter_category IS NULL OR mt.category = filter_category)
        ```
        This ensures:
        *   If `filter_category` is `NULL` (i.e., user selected "Any Category" in the UI), templates are *not* filtered by their `category` column.
        *   If `filter_category` has a value (e.g., "gym"), only templates where `mt.category` matches that value are returned.
    *   **Example Final SQL for `match_meme_templates` (verify parameters against your actual implementation):**
        ```sql
        CREATE OR REPLACE FUNCTION public.match_meme_templates(
            embedding_param vector,
            match_count_param integer,
            user_id_param uuid,
            persona_id_param uuid DEFAULT NULL,
            filter_greenscreen_param boolean DEFAULT NULL,
            filter_category TEXT DEFAULT NULL
        )
        RETURNS SETOF meme_templates
        LANGUAGE sql STABLE AS $$
        SELECT mt.*
        FROM public.meme_templates mt
        LEFT JOIN public.meme_feedback mf ON mt.id = mf.template_id
            AND mf.user_id = user_id_param
            AND ((persona_id_param IS NULL AND mf.persona_id IS NULL) OR (persona_id_param IS NOT NULL AND mf.persona_id = persona_id_param))
        WHERE mf.id IS NULL
            AND (filter_greenscreen_param IS NULL OR mt.is_greenscreen = filter_greenscreen_param)
            AND (filter_category IS NULL OR mt.category = filter_category)
            AND mt.embedding IS NOT NULL
        ORDER BY mt.embedding <=> embedding_param
        LIMIT match_count_param;
        $$;
        ```
    *   **Example Final SQL for `get_random_meme_templates` (verify parameters against your actual implementation):**
        ```sql
        CREATE OR REPLACE FUNCTION public.get_random_meme_templates(
            limit_count_param integer,
            user_id_param uuid,
            persona_id_param uuid DEFAULT NULL,
            filter_greenscreen_param boolean DEFAULT NULL,
            filter_category TEXT DEFAULT NULL
        )
        RETURNS SETOF meme_templates
        LANGUAGE plpgsql STABLE AS $$
        BEGIN
            RETURN QUERY
            SELECT mt.*
            FROM public.meme_templates mt
            LEFT JOIN public.meme_feedback mf ON mt.id = mf.template_id
                                            AND mf.user_id = user_id_param
                                            AND mf.persona_id = persona_id_param
            WHERE mf.id IS NULL
                AND (filter_greenscreen_param IS NULL OR mt.is_greenscreen = filter_greenscreen_param)
                AND (filter_category IS NULL OR mt.category = filter_category)
            ORDER BY random()
            LIMIT limit_count_param;
        END;
        $$;
        ```

## Troubleshooting Journey for Category Feature:

Several issues were encountered and resolved during the implementation of the category feature:

1.  **Initial "Unauthorized" Error on Category Update:**
    *   **Symptom:** When trying to approve a template with a category in `ReviewTemplatesTable.tsx`, the API call to `PATCH /api/templates/[id]` failed with a 401 "Unauthorized" error.
    *   **Investigation:**
        *   The API route was correctly checking for an authenticated user using `supabase.auth.getUser()`.
        *   The database update operation itself used `supabaseAdmin`, which bypasses RLS. This indicated the 401 was likely from the initial auth check.
    *   **Root Cause Found:** The `PATCH /api/templates/[id]/route.ts` was not initially modified to destructure `category` from the request body or include it in the `updateData` object sent to Supabase. While this wouldn't directly cause a 401, it was a necessary fix for the update to work. The "Unauthorized" error likely resolved due to session stabilization or unrelated factors, as the API route's *authentication check* logic was already in place.
    *   **Resolution:** The API route was updated to correctly handle the `category` field in the request and add it to the data being updated.

2.  **Meme Generator Not Filtering by Category:**
    *   **Symptom:** After setting a category in `MemeSelectorV2.tsx`, the template results were not filtered by that category.
    *   **Investigation:** Checked `POST /api/templates/select/route.ts`.
    *   **Root Cause Found:**
        1.  The Zod schema (`TemplateSelectSchema`) in the API route did not include `category`.
        2.  Therefore, `category` was not being extracted from the request body.
        3.  Consequently, `category` was not being passed to the Supabase RPC functions (`match_meme_templates` and `get_random_meme_templates`).
    *   **Resolution:**
        1.  Added `category: z.string().optional().nullable()` to `TemplateSelectSchema`.
        2.  Extracted `category` from the validated request data.
        3.  Passed `category` (as `filter_category_param` or `filter_category`) to the `rpcParams` for both RPC calls.

3.  **Supabase RPC Error `PGRST202` ("Could not find the function... Hint: Perhaps you meant to call...")**:
    *   **Symptom:** After updating `select/route.ts` to pass the category, calls to `get_random_meme_templates` failed.
    *   **Root Cause Found:** A mismatch existed between the parameter names used in the `rpcParams` object in `select/route.ts` (e.g., `limit_count`, `filter_greenscreen`) and the actual parameter names defined in the SQL `CREATE FUNCTION` statement for `get_random_meme_templates` (which the hint suggested were `limit_count_param`, `filter_greenscreen_param`).
    *   **Resolution:** Updated the keys in the `rpcParams` object in `select/route.ts` to exactly match the parameter names expected by the SQL function, as indicated by the error's hint.

4.  **Supabase RPC Error `PGRST203` ("Could not choose the best candidate function between...")**:
    *   **Symptom:** After fixing `PGRST202`, calls to `get_random_meme_templates` (especially when "Any Category" was selected, making `filter_category` effectively `null`) failed with this ambiguity error.
    *   **Root Cause Found:** Function overloading. Two versions of `get_random_meme_templates` existed in the database:
        1.  An older version: `get_random_meme_templates(limit_count_param, user_id_param, persona_id_param, filter_greenscreen_param)`
        2.  The new version: `get_random_meme_templates(limit_count_param, user_id_param, persona_id_param, filter_greenscreen_param, filter_category)`
        When `filter_category` was sent as `null` from the API, PostgREST couldn't definitively choose between these two signatures.
    *   **Resolution:** The older version of `get_random_meme_templates` (the one *without* the `filter_category` parameter) was dropped from the database using:
        ```sql
        DROP FUNCTION public.get_random_meme_templates(integer, uuid, uuid, boolean);
        ```
        This left only the intended version of the function, resolving the ambiguity.

## Feature: Video Reel Scraper & Initial Analysis (with Greenscreen Support)

**Goal:** To automate the process of fetching videos (Instagram Reels, TikToks, etc.) from URLs, extracting key information, performing an initial AI analysis, and storing them as new meme templates. This includes support for "greenscreen" style videos where caption extraction and video cropping are skipped, and example captions can be user-provided.

**Core Components & Flow:**

1.  **Frontend UI (`src/app/components/ReelScraperForm.tsx`):**
    *   Allows users to input a list of video URLs, one per line, into a textarea.
    *   Features a checkbox toggle for "Process as Greenscreen (TikToks, etc.)".
    *   **Input Format:**
        *   **Standard Mode (Greenscreen toggle OFF):** Each line contains just the video URL.
            ```
            https://www.instagram.com/reel/example1/
            https://www.anotherplatform.com/video/example2
            ```
        *   **Greenscreen Mode (Greenscreen toggle ON):** Each line contains the video URL, optionally followed by comma-separated example captions.
            ```
            https://www.tiktok.com/@user/video/123,Optional caption one,Another example
            https://www.youtube.com/shorts/greenscreen_example_without_captions
            ```
    *   **Processing Logic:**
        *   When the form is submitted, the component iterates through each line from the textarea.
        *   It parses the URL and any example captions (if in greenscreen mode and captions are provided).
        *   For each URL, it makes an individual `POST` request to the `/api/scrape-reels` backend endpoint.

2.  **API Endpoint (`POST /api/scrape-reels/route.ts`):**
    *   Located at `src/app/api/scrape-reels/route.ts`.
    *   Accepts a JSON request body for a single URL with the following structure:
        ```typescript
        interface ScrapeReelRequestBody {
          url: string;                   // The video URL to process
          isGreenscreen: boolean;        // True if greenscreen mode is active for this URL
          exampleCaptions?: string[];    // Optional: User-provided captions (if isGreenscreen is true)
        }
        ```
    *   **Python Script Invocation:**
        *   Spawns the Python script `src/lib/meme-scraper/process_reels.py` using `child_process.spawn`.
        *   Passes the `url` as a command-line argument to the script.
        *   If `isGreenscreen` from the request body is `true`, it passes an additional `--is-greenscreen` flag to the Python script.
        *   Necessary environment variables (Supabase credentials, Google Cloud credentials if used by Python) are passed to the script's environment.
    *   **Python Script Responsibilities (`src/lib/meme-scraper/process_reels.py`):**
        *   The Python script is responsible for the heavy lifting of video download and initial processing.
        *   It uses `argparse` to accept the `url` and the optional `--is-greenscreen` flag.
        *   **Video Downloading:** Uses a library like `yt-dlp` (via `downloader.py`) to download the video from the `url`.
        *   **Conditional Processing based on `--is-greenscreen`:**
            *   **If `--is-greenscreen` is present:**
                *   Video cropping (e.g., via `video_cropper.py`) is **skipped**.
                *   Caption/text extraction from video frames (e.g., via `caption_extractor.py` using Google Vision API) is **skipped**.
                *   The originally downloaded video file is designated for upload.
                *   The `captionText` returned in its JSON output will be `null`.
            *   **If `--is-greenscreen` is NOT present (standard mode):**
                *   A frame is extracted from the video (e.g., via `frame_extractor.py`).
                *   The video is cropped based on this frame.
                *   Captions/text are extracted from the frame using an OCR tool (like Google Vision API).
                *   The cropped video file is designated for upload.
                *   The extracted `captionText` is included in its JSON output.
        *   **Video Upload:** The processed video (original for greenscreen, cropped for standard) is uploaded to a persistent storage (e.g., Supabase Storage) using a helper like `storage_uploader.py`. This helper returns the public URL of the stored video.
        *   **Output:** The Python script prints a JSON object to its standard output, including:
            *   `success: boolean`
            *   `finalVideoUrl: string` (URL of the video in storage)
            *   `captionText: string | null` (extracted caption or null)
            *   `instagramId: string` (an extracted ID from the URL or a generated UUID)
            *   `originalUrl: string` (the input URL, echoed back)
            *   `error?: string` (if any error occurred)
    *   **Result Handling from Python (in Node.js `/api/scrape-reels` route):**
        *   The Node.js route captures and parses the JSON output from the Python script.
        *   If the Python script indicates failure or essential data like `finalVideoUrl` is missing, the API returns an error response.
    *   **Node.js Post-Python Processing & Database Interaction:**
        1.  **Determine `finalScrapedCaption`:**
            *   If `isGreenscreen` was true in the request and `exampleCaptions` were provided, these are joined (e.g., with a newline character: `\\n`) to form the `finalScrapedCaption`.
            *   If `isGreenscreen` was false, the `captionText` received from the Python script is used as `finalScrapedCaption`.
            *   If neither of the above, `finalScrapedCaption` remains `null`.
        2.  **Generate Thumbnail:** Makes an internal `POST` request to `/api/generate-thumbnail` (not detailed here) with the `finalVideoUrl` to create and store a poster/thumbnail image. The URL of this thumbnail is retrieved.
        3.  **Initial AI Analysis:**
            *   Makes an internal `POST` request to `/api/analyze-video-template`.
            *   The request body to this analysis endpoint includes:
                *   `videoUrl`: The `finalVideoUrl`.
                *   `exampleCaption`: The `finalScrapedCaption` determined above.
                *   `isGreenscreen`: The boolean flag indicating the mode.
            *   The `/api/analyze-video-template` route (see details in its own section) uses an LLM (e.g., Gemini via `getGeminiVideoAnalysisPrompt`) to generate a `suggestedName` and `analysis` (detailed instructions) for the new meme template. The prompt for `isGreenscreen` videos is specifically tuned to instruct the AI to ignore the greenscreen background in its description.
        4.  **Generate Embedding:** The AI-generated `analysis` text is used to create a vector embedding via the `generateEmbedding` utility function (e.g., using OpenAI's embedding models).
        5.  **Database Insertion:**
            *   A new record is inserted into the `public.meme_templates` table using `supabaseAdmin`.
            *   The payload includes:
                *   `name`: The `suggestedName` from the AI analysis.
                *   `video_url`: The `finalVideoUrl`.
                *   `poster_url`: The URL of the generated thumbnail.
                *   `instructions`: The `analysis` text from the AI.
                *   `original_source_url`: The initial URL provided by the user.
                *   `embedding`: The generated vector embedding.
                *   `is_greenscreen`: The boolean `isGreenscreen` flag from the original request.
                *   `reviewed`: `false` (newly scraped templates always start as unreviewed).
                *   `uploader_name`: Set to 'Scraper'.
                *   `scraped_example_caption`: The `finalScrapedCaption` (either user-provided for greenscreen or AI-extracted for standard).
    *   **API Response:** The `/api/scrape-reels` route returns a JSON object to the frontend, summarizing the outcome for the processed URL (success or error, message, and new `templateId` if successful).

3.  **AI Video Analysis Endpoint (`POST /api/analyze-video-template/route.ts`):**
    *   Located at `src/app/api/analyze-video-template/route.ts`.
    *   Accepts a JSON request body:
        ```typescript
        interface AnalyzeVideoRequestBody {
          videoUrl: string;
          exampleCaption?: string | null;
          feedbackContext?: string | null; // For re-analysis feature
          isGreenscreen?: boolean;         // Indicates if the video is a greenscreen template
        }
        ```
    *   Constructs a detailed prompt for an LLM (e.g., Gemini Pro) using the `getGeminiVideoAnalysisPrompt` utility from `src/lib/utils/prompts.ts`.
        *   If `isGreenscreen` is true, `getGeminiVideoAnalysisPrompt` modifies the prompt to instruct the AI:
            *   To focus its analysis (especially the "VISUAL DESCRIPTION") on foreground subjects and actions.
            *   To explicitly NOT describe or mention the greenscreen background itself, assuming it will be replaced.
    *   The API fetches the video content from `videoUrl`, converts it to base64, and sends it along with the prompt to the LLM.
    *   Parses the LLM's response to extract a `suggestedName` and the main `analysis` text.
    *   Returns these (`suggestedName`, `analysis`) in a JSON response.

4.  **Prompt Engineering (`getGeminiVideoAnalysisPrompt` in `src/lib/utils/prompts.ts`):**
    *   This function dynamically constructs the prompt for the video analysis AI.
    *   It takes parameters including `exampleCaption`, `feedbackContext` (for re-analysis), and `isGreenscreen`.
    *   If `isGreenscreen` is true, it injects specific instructions into the prompt regarding how the AI should treat greenscreen backgrounds (i.e., ignore them and focus on foreground action).
    *   The prompt guides the AI to generate a structured analysis including a suggested name, visual description, emotional context, usage patterns, and an analysis of any provided example caption, plus generation of new examples.

## Feature: Template Re-analysis with Feedback

**Goal:** To allow administrators to provide feedback on an AI-generated template analysis (specifically its `instructions` and `suggestedName`) and trigger a re-processing of the video with this new context, aiming for a refined analysis.

**Core Components & Flow:**

1.  **Frontend UI (`EditTemplateModal` in `src/app/components/ReviewTemplatesTable.tsx`):**
    *   Displays the current `name` (Suggested Name) and `instructions` (AI Analysis) for a template.
    *   Provides a textarea for "Feedback for Re-analysis."
    *   Includes a "Save & Start Re-analysis" button.
    *   **Action:** When clicked, this button:
        *   Makes a `PATCH` request to `/api/templates/[id]`.
        *   The request body includes:
            *   Any direct modifications made to `modalName` or `modalInstructions` in the modal.
            *   `triggerReanalysis: true`.
            *   `feedbackContext`: The text from the "Feedback for Re-analysis" textarea.
        *   Expects a `202 Accepted` response, after which it closes the modal and triggers a refresh of the template list.

2.  **API Endpoint (`PATCH /api/templates/[id]/route.ts`):**
    *   **Authentication:** Verifies the user is authenticated.
    *   **Input Validation:** Validates `name`, `instructions`, `reviewed`, `is_duplicate`, `category`, `triggerReanalysis`, and `feedbackContext`. Requires `feedbackContext` if `triggerReanalysis` is true.
    *   **Synchronous Updates:**
        *   If `name`, `reviewed`, `is_duplicate`, or `category` are provided, these fields are updated in the `meme_templates` table immediately.
        *   If `instructions` are directly edited and provided, these are updated, and a new vector `embedding` is synchronously generated and saved for these new instructions.
    *   **Asynchronous Re-analysis Trigger:**
        *   If `triggerReanalysis: true` and `feedbackContext` are present:
            *   The API immediately returns a `202 Accepted` response to the client.
            *   It then spawns a background (async) task to perform the re-analysis:
                1.  **Fetch Template Data:** Retrieves the `video_url` (or `original_source_url`) and `scraped_example_caption` for the template ID from the database. The `scraped_example_caption` is the original caption extracted during the initial scraping process.
                2.  **Call Video Analysis Helper:** Invokes the `runVideoAnalysisWithAI` helper function, passing:
                    *   `videoUrlToAnalyze`
                    *   `templateForReanalysis.scraped_example_caption` (as `exampleCaption`)
                    *   `feedbackContext` (from the client's request)
                    *   The original `NextRequest` object (for constructing internal URLs).
                3.  **Process Analysis Results:**
                    *   `runVideoAnalysisWithAI` calls the internal `/api/analyze-video-template` endpoint (see details below).
                    *   If the internal call is successful, it returns a `newSuggestedName` and `newAnalysis`.
                4.  **Update Database:**
                    *   Prepares an update payload with the `newSuggestedName` (if provided and non-empty) and the `newAnalysis`.
                    *   Generates a new vector `embedding` from the `newAnalysis`.
                    *   Updates the corresponding template in `meme_templates` table with the new name, instructions, and embedding.
                    *   Logs success or errors.

3.  **Helper Function (`runVideoAnalysisWithAI` in `src/app/api/templates/[id]/route.ts`):**
    *   A simple wrapper that makes an internal `fetch` call to the `/api/analyze-video-template` endpoint.
    *   Passes `videoUrl`, `exampleCaption`, and `feedbackContext`.
    *   Returns the `suggestedName` and `analysis` from the internal API's response.

4.  **AI Video Analysis Endpoint (`POST /api/analyze-video-template/route.ts`):**
    *   Accepts `videoUrl`, `exampleCaption` (optional), and `feedbackContext` (optional) in its request body.
    *   Uses `getGeminiVideoAnalysisPrompt` to construct the prompt for the LLM.
        *   The prompt is designed to instruct the LLM to prioritize the `feedbackContext`.
        *   It also specifically asks the LLM to analyze the provided `exampleCaption` (which, in the re-analysis flow, is the `scraped_example_caption`) in light of the (refined) understanding of the template.
        *   It also asks the LLM to generate additional new examples.
    *   Calls the LLM (e.g., Gemini) with the video and the constructed prompt.
    *   Returns the LLM's `suggestedName` and `analysis` (which includes the re-evaluation of the original example and new examples).

5.  **Prompt (`getGeminiVideoAnalysisPrompt` in `src/lib/utils/prompts.ts`):**
    *   Dynamically incorporates `feedbackContext` if provided, instructing the AI to prioritize it for refining its understanding.
    *   Includes a section for analyzing the provided `exampleCaption`, asking the AI to explain why that specific caption works with the video, considering the (refined) template understanding.
    *   Includes a section for generating additional hypothetical examples.

6.  **Database Schema (`meme_templates` table):**
    *   `scraped_example_caption TEXT NULL`: Crucially used here as the "original example caption" that is re-evaluated during the feedback-driven re-analysis process.
    *   `instructions TEXT`: Stores the AI's analysis of the template. Updated by the re-analysis.
    *   `name TEXT`: Stores the AI's suggested name for the template. Updated by the re-analysis.
    *   `embedding VECTOR`: Updated with the embedding of the new `instructions` after re-analysis.

## Feature: Meme Generation & Canvas Preview

**Goal:** To provide users with an intuitive interface for creating memes by selecting templates, adding captions, customizing text styling, choosing backgrounds (for greenscreen), and generating both live canvas previews and downloadable video files with consistent rendering quality.

### Architecture Overview

The meme generation system consists of three main layers that work together to ensure consistent rendering between preview and final video:

1. **UI Layer (`MemeGenerator.tsx`)** - Manages user inputs and state
2. **Processing Hook (`useVideoProcessing.ts`)** - Coordinates preview and video generation
3. **Rendering Utilities (`previewGenerator.ts` & `videoProcessor.ts`)** - Handle actual canvas/video rendering

### Core Components & Technical Flow

#### 1. Frontend UI (`src/app/components/MemeGenerator.tsx`)

**State Management:**
- `caption`: User's text input for the meme caption
- `textSettings`: Font, size, color, alignment, vertical position, stroke weight, background settings
- `selectedBackground`: Background image URL for greenscreen templates
- `labels`: Array of positioned text labels for non-cropped modes
- `watermarkSettings`: Watermark text, position, styling, and background options
- `videoVerticalOffset`: Percentage-based vertical positioning (0-100) for video placement
- `isCropped`: Boolean determining layout mode (dynamic height vs. fixed canvas)
- `isGreenscreenMode`: Boolean indicating greenscreen template processing

**Key UI Controls:**
- **Caption Input:** Text area for main meme text
- **Text Styling Panel:** Font selection, size, color, alignment, vertical position, stroke weight
- **Text Background Panel:** Background color, opacity settings for improved readability
- **Video Position Slider:** Vertical offset control (disabled in cropped mode)
- **Background Selector:** Image picker for greenscreen backgrounds
- **Label Manager:** Add/edit positioned text labels (non-cropped only)
- **Watermark Settings:** Text, position, styling, and background options

**Layout Mode Logic:**
```typescript
// Cropped mode: Canvas height dynamically adjusts to content
isCropped = !isGreenscreenMode && someCondition;

// Non-cropped mode: Fixed 1080x1920 canvas with flexible positioning
isCropped = false;
```

#### 2. Video Processing Hook (`src/app/lib/hooks/useVideoProcessing.ts`)

**Purpose:** Centralized coordination between preview generation and video processing to ensure parameter consistency.

**Key Functions:**
- `generatePreview()`: Creates live canvas preview using `previewGenerator.ts`
- `processAndDownloadMeme()`: Generates final video using `videoProcessor.ts`

**Parameter Passing:**
```typescript
// Both functions receive identical parameters to ensure consistency
const sharedParams = {
  videoUrl,
  caption,
  backgroundImage: selectedBackground,
  isGreenscreen: isGreenscreenMode,
  textSettings,
  labels,
  labelSettings,
  isCropped,
  isWatermarkEnabled,
  watermarkSettings,
  videoVerticalOffset
};

// Preview generation (real-time)
await createMemePreview(previewCanvas, ...sharedParams);

// Video generation (download)
const videoBlob = await createMemeVideo(...sharedParams);
```

#### 3. Canvas Rendering System

Both `previewGenerator.ts` and `videoProcessor.ts` implement identical rendering logic to ensure visual consistency between preview and final video.

**Shared Rendering Pipeline:**

1. **Canvas Setup**
   ```typescript
   // Standard dimensions
   const standardWidth = 1080;
   const standardHeight = 1920;
   
   // Dynamic height calculation for cropped mode
   if (isCropped && !isGreenscreen) {
     const estimatedTextHeight = calculateTextHeight(caption, textSettings);
     canvas.height = 30 + estimatedTextHeight + 15 + videoHeight + 15;
   } else {
     canvas.height = standardHeight; // Fixed height
   }
   ```

2. **Video Positioning Logic**
   ```typescript
   // Calculate base video position
   const videoAspect = video.width / video.height;
   const targetWidth = standardWidth;
   const targetHeight = targetWidth / videoAspect;
   let yOffset = (canvas.height - targetHeight) / 2; // Default center
   
   // Apply user's vertical offset (non-cropped mode only)
   if (videoVerticalOffset !== undefined && !isCropped) {
     const desiredCenterY = (canvas.height * videoVerticalOffset) / 100;
     const calculatedYOffset = desiredCenterY - (targetHeight / 2);
     yOffset = Math.max(0, Math.min(calculatedYOffset, canvas.height - targetHeight));
   }
   
   // Special positioning for cropped mode
   if (isCropped && !isGreenscreen) {
     const textBottom = calculateTextBottom(caption, textSettings);
     yOffset = textBottom + 15; // Fixed 15px gap below text
   }
   ```

3. **Greenscreen Processing**
   ```typescript
   function processGreenscreen(video, width, height) {
     // Create temporary canvas for chroma key processing
     const tempCanvas = document.createElement('canvas');
     const ctx = tempCanvas.getContext('2d');
     
     // Draw video frame
     ctx.drawImage(video, 0, 0, width, height);
     
     // Get pixel data for processing
     const imageData = ctx.getImageData(0, 0, width, height);
     const pixels = imageData.data;
     
     // Green screen removal algorithm
     for (let i = 0; i < pixels.length; i += 4) {
       const r = pixels[i];
       const g = pixels[i + 1];
       const b = pixels[i + 2];
       
       // Detect green pixels and make transparent
       if (g > 100 && g > 1.4 * r && g > 1.4 * b) {
         pixels[i + 3] = 0; // Set alpha to 0 (transparent)
       }
     }
     
     ctx.putImageData(imageData, 0, 0);
     return tempCanvas;
   }
   ```

4. **Text Rendering System**
   
   **Critical Fix Applied:** The text rendering was standardized between preview and video to ensure consistency:
   
   ```typescript
   function drawCaption(ctx, caption, canvasWidth, canvasHeight, textSettings, isCropped) {
     const font = textSettings?.font || 'Impact';
     const size = textSettings?.size || 78;
     const strokeWeight = textSettings?.strokeWeight || 0.08;
     
     // FIXED: Correct stroke width calculation
     ctx.lineWidth = size * strokeWeight; // Multiply by font size, not strokeWeight
     
     // Text positioning logic
     let y;
     if (isCropped) {
       ctx.textBaseline = 'top';
       y = 30; // Fixed 30px from top
     } else {
       ctx.textBaseline = 'bottom';
       y = (canvasHeight * verticalPosition) / 100;
     }
     
     // FIXED: Simplified Y calculation for consistency
     lines.forEach((line, index) => {
       let currentLineY;
       if (isCropped) {
         currentLineY = y + (index * lineHeight);
       } else {
         // Position so BOTTOM of LAST line is at specified vertical position
         currentLineY = y - (lines.length - 1 - index) * lineHeight;
       }
       
       // Draw stroke and fill
       ctx.strokeText(line, x, currentLineY);
       ctx.fillText(line, x, currentLineY);
     });
   }
   ```

5. **Label and Watermark Rendering**
   ```typescript
   // Labels (non-cropped mode only)
   if (labels && !isCropped) {
     labels.forEach(label => {
       const x = canvasWidth * (label.horizontalPosition / 100);
       const y = canvasHeight * (label.verticalPosition / 100);
       // Render with background and stroke
     });
   }
   
   // Watermark (positioned relative to video bounds)
   if (isWatermarkEnabled && watermarkSettings) {
     const videoRect = calculateVideoRect(yOffset, targetWidth, targetHeight);
     const watermarkX = videoRect.x + (watermarkSettings.horizontalPosition / 100) * videoRect.width;
     const watermarkY = videoRect.y + (watermarkSettings.verticalPosition / 100) * videoRect.height;
     drawWatermark(ctx, watermarkX, watermarkY, watermarkSettings);
   }
   ```

#### 4. Video Processing Specifics (`src/lib/utils/videoProcessor.ts`)

**Media Handling:**
- Uses `HTMLVideoElement` and `HTMLCanvasElement` for video capture
- Implements `MediaRecorder` API for video encoding
- Handles audio stream synchronization
- Supports multiple codec formats with fallback

**Recording Pipeline:**
```typescript
// Set up canvas stream with 30fps
const canvasStream = canvas.captureStream(30);

// Add audio track from video
const audioStream = videoElement.captureStream();
const audioTracks = audioStream.getAudioTracks();
if (audioTracks.length > 0) {
  canvasStream.addTrack(audioTracks[0]);
}

// Create recorder with optimized settings
const recorder = new MediaRecorder(canvasStream, {
  mimeType: 'video/mp4;codecs=h264,aac', // With fallbacks
  videoBitsPerSecond: 8000000, // 8Mbps for quality
});

// Sync recording with video playback
videoElement.addEventListener('timeupdate', handleTimeUpdate);
const earlyStopTime = videoDuration - 0.1; // Stop before video ends
```

**Frame Rendering Loop:**
```typescript
const renderFrame = () => {
  // Clear canvas
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw background (greenscreen mode)
  if (isGreenscreen && backgroundImage) {
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    const processedFrame = processGreenscreen(videoElement, targetWidth, targetHeight);
    ctx.drawImage(processedFrame, 0, finalYOffset, targetWidth, targetHeight);
  } else {
    // Draw video directly
    ctx.drawImage(videoElement, 0, finalYOffset, targetWidth, targetHeight);
  }
  
  // Draw text layers
  drawCaption(ctx, caption, canvas.width, canvas.height, textSettings, isCropped);
  drawLabels(ctx, labels, canvas.width, canvas.height, labelSettings);
  drawWatermark(ctx, watermarkX, watermarkY, watermarkSettings);
};

// Animation loop during recording
const updateCanvas = () => {
  renderFrame();
  animationFrameId = requestAnimationFrame(updateCanvas);
};
```

#### 5. Layout Modes

**Cropped Mode (`isCropped = true`):**
- Canvas height dynamically adjusts to content
- Text positioned 30px from top
- Video positioned 15px below text
- 15px bottom padding
- Video vertical offset disabled
- Labels disabled (incompatible with dynamic height)

**Standard Mode (`isCropped = false`):**
- Fixed 1080x1920 canvas
- Text positioned by percentage (vertical position setting)
- Video positioned by percentage (with vertical offset override)
- Labels enabled with percentage positioning
- Full watermark support

**Greenscreen Mode (`isGreenscreen = true`):**
- Always uses standard mode (fixed canvas)
- Background image fills entire canvas
- Video processed for chroma key removal
- Video composited over background
- All positioning features available

#### 6. Consistency Mechanisms

**Parameter Synchronization:**
- `useVideoProcessing` hook ensures identical parameters passed to both preview and video generation
- Shared TypeScript interfaces enforce parameter consistency
- Common utility functions used by both rendering paths

**Rendering Standardization:**
- Identical drawing functions (`drawCaption`, `drawLabels`, `drawWatermark`)
- Shared text wrapping and measurement logic
- Consistent stroke width calculations
- Unified positioning algorithms

**Testing & Validation:**
- Preview serves as real-time validation of final video output
- Changes in preview immediately reflect in video generation
- User can verify appearance before initiating download

### Error Handling & Performance

**Resource Management:**
- Proper cleanup of media elements and streams
- Canvas element lifecycle management
- Memory cleanup on component unmount

**Error Recovery:**
- Graceful fallback for unsupported codecs
- Audio capture fallback mechanisms
- Canvas API error handling

**Performance Optimization:**
- 30fps recording for smooth playback
- Optimized greenscreen processing
- Efficient text measurement and caching
- Strategic animation frame usage

## Feature: Adding New AI Models for Caption Generation

**Goal:** To expand the list of available AI models that can be used to generate meme captions within the `MemeSelectorV2.tsx` component.

**Core Components & Flow:**

Adding a new AI model for caption generation involves modifications in two primary locations: the frontend component responsible for displaying model choices and making requests, and the backend API route that handles a_i_chat requests and interfaces with the various AI providers via the Vercel AI SDK.

1.  **Frontend Modifications (`src/app/components/MemeSelectorV2.tsx`):**
    *   **Update Model List:** Add the new model's user-facing identifier to the `models` array. This array populates the internal list of models for which captions will be generated.
        ```typescript
        // Example: Adding 'new-model-id'
        const models = [
          'anthropic-3.5',
          'claude-sonnet-4-20250514',
          'new-model-id', // <-- Add new model here
          // ... other existing models
        ];
        ```
    *   **Update Display Name Function:** Add a case to the `getModelDisplayName` function to provide a user-friendly name for the new model in the UI.
        ```typescript
        const getModelDisplayName = (modelId: string) => {
          switch (modelId) {
            // ... existing cases ...
            case "new-model-id": // <-- Add case for new model
              return "New Model Pretty Name";
            default:
              return modelId;
          }
        };
        ```

2.  **Backend API Route Modifications (`src/app/api/ai/chat/route.ts`):**
    *   **Update Request Body Schema (Zod):** Add the new model's user-facing identifier to the `model` enum in the `RequestBodySchema`. This ensures that requests from the frontend with this new model ID pass validation.
        ```typescript
        const RequestBodySchema = z.object({
          model: z.enum([
            'openai-4.1',
            'openai-4o',
            'anthropic-3.5',
            'claude-sonnet-4-20250514',
            'new-model-id', // <-- Add new model ID to Zod enum
            'google-gemini-2.5-pro',
            'grok-3-latest'
          ]),
          // ... rest of schema ...
        });
        ```
    *   **Update Provider Configuration Map:** Add a new entry to the `providers` constant. This is a critical step and requires the **actual model identifier expected by the Vercel AI SDK / specific AI provider**, which might be different from the user-facing ID used above.
        ```typescript
        const providers = {
          // ... existing provider configurations ...
          'new-model-id': { // <-- Key is the user-facing ID from frontend/schema
            init: createProviderFunction, // e.g., createOpenAI, createAnthropic
            model: 'actual-provider-model-name', // <-- CRITICAL: Specific model name for the SDK
            apiKeyEnv: 'PROVIDER_API_KEY_ENV_VAR', // Environment variable for the API key
          },
          // ... other existing provider configurations ...
        };
        ```
        *   `init`: The function from the Vercel AI SDK used to initialize the provider (e.g., `createOpenAI`, `createAnthropic`, `createGoogleGenerativeAI`).
        *   `model`: **This is the crucial part.** It must be the exact model string that the respective AI provider's SDK expects (e.g., `gpt-4o`, `claude-3-5-sonnet-20240620`, `gemini-pro`). This might not be the same as the user-facing identifier.
        *   `apiKeyEnv`: The name of the environment variable that stores the API key for this provider.

3.  **Special Handling (If Applicable):**
    *   If the new model provider is not directly supported by a `create<Provider>` function in the Vercel AI SDK (like the `grok-3-latest` example in the current `route.ts`), you will need to implement custom fetch logic to call that provider's API directly. This typically involves setting up the API endpoint, request body, headers (including authorization), and handling the response.

**Key Consideration for Future Model Additions:**

The most common point of failure or confusion when adding a new model is the distinction between:

*   **User-Facing/Schema ID:** The identifier used in `MemeSelectorV2.tsx`'s `models` array and in the `RequestBodySchema` in `chat/route.ts`. This can be a more user-friendly or abstracted name (e.g., `anthropic-3.7`).
*   **Actual Provider SDK Model ID:** The specific model string required by the Vercel AI SDK in the `providers` map's `model` field within `chat/route.ts` (e.g., `claude-3-7-sonnet-20250219`).

**Ensure that the `model` property in the `providers` object in `src/app/api/ai/chat/route.ts` uses the precise identifier recognized by the AI provider's API or the Vercel AI SDK wrapper for that provider.** An incorrect SDK model ID will lead to errors when the backend tries to invoke the model, even if the frontend and schema validation pass.
