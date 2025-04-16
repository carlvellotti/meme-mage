# Template Browser Performance Improvements Plan

This document outlines the steps taken to improve the performance of the `TemplateBrowser` component.

## Phase 1: Video Thumbnails (Poster Images)

Implemented video thumbnails to improve initial load performance by displaying a static image preview instead of loading video metadata upfront.

### Implementation Steps

1.  **Database Schema Update:**
    *   Added a `poster_url TEXT` column to the `meme_templates` table.
        ```sql
        ALTER TABLE meme_templates ADD COLUMN poster_url TEXT;
        ```

2.  **Update Supabase Types (`src/lib/supabase/types.ts`):**
    *   Added `poster_url?: string | null;` to the `MemeTemplate` interface.

3.  **Create Thumbnail Generation API Endpoint (`src/app/api/generate-thumbnail/route.ts`):**
    *   Created an API route that accepts a `videoUrl`.
    *   Downloads the video, uses FFmpeg (`-ss 00:00:01.000 -vframes 1`) to extract a thumbnail at 1s.
    *   Uploads the thumbnail (`.jpg`) to Supabase Storage under a `thumbnails/` path.
    *   Returns the public `thumbnailUrl`.

4.  **Modify `TemplateUploader.tsx`:**
    *   After video upload, calls `/api/generate-thumbnail`.
    *   Includes the returned `thumbnailUrl` in the `poster_url` field when inserting into the database.

5.  **Create Backfill Script (`scripts/backfill-thumbnails.mjs`):**
    *   Created a Node.js script to process existing templates lacking a `poster_url`.
    *   Fetches templates in batches, downloads video, runs FFmpeg, uploads thumbnail, and updates the database record.
    *   **Fix:** Added filename sanitization (`sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');`) to handle special characters in original video filenames, preventing broken storage URLs.
    *   **Fix:** Required running SQL (`UPDATE meme_templates SET poster_url = NULL WHERE poster_url LIKE '%/%25%';`) to reset broken URLs generated before the sanitization fix, allowing the script to reprocess them correctly.

6.  **Update `TemplateBrowser.tsx` (Poster Attribute):**
    *   Confirmed `/api/templates` returns `poster_url` (due to `select('*')`).
    *   Added the `poster={template.poster_url || ''}` attribute to the `<video>` element.

## Phase 2: Backend Pagination

Implemented backend pagination to avoid fetching all templates at once, improving scalability and reducing initial data load.

### Implementation Steps

1.  **Modify API Route (`src/app/api/templates/route.ts`):**
    *   Modified the `GET` handler to accept `page` (default 1) and `limit` (default 12) query parameters.
    *   Used Supabase `.range(from, to)` to fetch only the templates for the requested page.
    *   Added a separate Supabase query (`select('*', { count: 'exact', head: true })`) to get the `totalCount` of templates.
    *   Updated the response format to return `{ templates: MemeTemplate[], totalCount: number }`.

2.  **Refactor `TemplateBrowser.tsx` (Pagination Logic):**
    *   **State:** Replaced `templates` and `visibleTemplates` with `loadedTemplates`. Added state for `page`, `totalCount`, `hasMore`, and `isLoadingMore`.
    *   **Fetching:** Created `fetchTemplatesPage(pageNum, isRefresh)` function (using `useCallback`) to fetch a specific page, append results to `loadedTemplates`, and update `totalCount`, `page`, and `hasMore` states.
    *   **Initial Load:** Modified `useEffect` to call `fetchTemplatesPage(1)` on mount.
    *   **Infinite Scroll:** Updated Intersection Observer logic to check `hasMore` and loading states, triggering `fetchTemplatesPage(page + 1)` when the loading element is visible.
    *   **Refresh:** Updated `refreshTemplates` function (using `useCallback`) to reset state and call `fetchTemplatesPage(1, true)`.
    *   **Rendering:** Updated the component to map over `loadedTemplates` and display the loading indicator/empty states based on the new state variables. Displayed `totalCount` in the heading.

3.  **Bug Fix (Infinite Refresh Loop):**
    *   **Issue:** An infinite refresh loop occurred because `loadedTemplates.length` was included in the `fetchTemplatesPage` `useCallback` dependency array. This caused the callback function to be recreated on every fetch, triggering the Intersection Observer `useEffect` to re-run and re-fetch.
    *   **Fix:** Removed the unstable `loadedTemplates.length` dependency from `fetchTemplatesPage`'s `useCallback` array (changed to `[]`). Adjusted dependencies for `refreshTemplates` and the Intersection Observer `useEffect` accordingly to rely on the now stable `fetchTemplatesPage` callback. 