# Tech Spec: Watermark & Caption Logging

**Date:** 2024-07-26

## Goals

1.  Implement an optional, customizable watermark feature for generated memes.
2.  Persist watermark settings locally for user convenience.
3.  Log initial AI-generated captions and final user-edited captions upon download for future analysis or fine-tuning.

## Plan Details

### 1. Database Schema (Caption Logging)

*   **Table Name:** `meme_generation_log`
*   **Columns:**
    *   `id`: `uuid` (Primary Key, default: `gen_random_uuid()`)
    *   `created_at`: `timestamp with time zone` (Default: `now()`)
    *   `user_id`: `uuid` (Foreign Key to `auth.users.id`, On Delete Cascade)
    *   `template_id`: `uuid` (Foreign Key to `public.meme_templates.id`, On Delete Set Null) - Set Null in case template is deleted.
    *   `initial_ai_caption`: `text` (The caption originally selected in MemeSelectorV2)
    *   `final_user_caption`: `text` (The caption present when the user clicked download)
*   **Implementation:** Create a new Supabase migration file defining this table and its constraints.

### 2. Watermark Implementation

*   **Component:** `src/app/components/MemeGenerator.tsx`
*   **State:**
    *   `isWatermarkEnabled`: `boolean` (Default: `true`)
    *   `watermarkSettings`: `object` containing:
        *   `text`: `string` (Default: `personaName` prop, fallback to '')
        *   `horizontalPosition`: `number` (Default: 95 - representing % from left)
        *   `verticalPosition`: `number` (Default: 95 - representing % from top)
        *   `size`: `number` (Default: 47)
        *   `font`: `string` (Default: 'Arial')
        *   `color`: `'white' | 'black'` (Default: 'black')
        *   `strokeWeight`: `number` (Default: 0 - watermark likely won't need stroke)
        *   `opacity`: `number` (Default: 0.5 - representing 50% opacity)
        *   `backgroundColor`: `'black' | 'white' | 'transparent'` (Default: 'transparent')
        *   `backgroundOpacity`: `number` (Default: 0.5 - only applies if background is not transparent)
*   **Persistence:**
    *   Use `localStorage` with a dedicated key (e.g., `memeGenerator_watermarkSettings`).
    *   On mount, attempt to load settings from `localStorage`. If present, use them (but potentially still override `text` with the current `personaName` if desired, TBD). If not present, initialize with defaults.
    *   Save the `watermarkSettings` object to `localStorage` whenever any setting is changed.
*   **UI:**
    *   Add a new collapsible section titled "Watermark" within the editor panel.
    *   Include a toggle switch (`isWatermarkEnabled`).
    *   Include controls mirroring the "Label Style" section for `text`, `font`, `size`, `color`, `opacity`, `backgroundColor`, `backgroundOpacity`, `strokeWeight`.
    *   Include sliders for `horizontalPosition` and `verticalPosition`.
*   **Canvas Logic:**
    *   Modify `src/lib/utils/previewGenerator.ts` (`createMemePreview`) and `src/lib/utils/videoProcessor.ts` (`createMemeVideo`).
    *   Both functions will accept `isWatermarkEnabled: boolean` and `watermarkSettings: object` as new arguments.
    *   Inside the functions, if `isWatermarkEnabled` is true, use the `watermarkSettings` to draw the text onto the canvas, applying opacity and positioning correctly.
*   **Function Calls:** Update calls to `createMemePreview` and `createMemeVideo` within `MemeGenerator.tsx` to pass the `isWatermarkEnabled` state and the `watermarkSettings` object.

### 3. Caption Tracking Implementation

*   **Component:** `src/app/components/MemeGenerator.tsx`
*   **Function:** `handleDownloadMeme`
*   **Logic:**
    1.  Inside the `try` block, *before* calling `createMemeVideo`.
    2.  Get the current user's ID: `const { data: { user } } = await supabase.auth.getUser();`. Handle potential null user.
    3.  Retrieve necessary data: `user.id`, `selectedTemplate.id`, `initialCaption` (from props), `caption` (from state).
    4.  Execute Supabase insert:
        ```javascript
        const { error: logError } = await supabase
          .from('meme_generation_log')
          .insert({
            user_id: userId, // from auth check
            template_id: selectedTemplate.id,
            initial_ai_caption: initialCaption, // from props
            final_user_caption: caption // from state
          });

        if (logError) {
          console.error('Error logging meme generation:', logError);
          // Optionally show a non-blocking toast message
          // toast.error('Could not log generation details.');
        }
        ```
    5.  Proceed with `createMemeVideo` and the rest of the download logic regardless of logging success/failure.

### 4. Data Flow

*   `MemeSelectorV2.tsx` continues to pass `initialCaption` and `personaName` as props to `MemeGenerator.tsx`.
*   `MemeGenerator.tsx` uses `personaName` for the default watermark text and `initialCaption` for the logging data. 

## Known Issues (as of 2024-07-26)

1.  **Watermark Persistence:** The intended `localStorage` persistence for watermark settings is not currently working reliably. Settings reset to default when generating a new meme instead of retaining the user's last used settings.
2.  **Watermark Preview Discrepancy (Cropped Mode):** When the "Crop" feature is enabled, the watermark's position in the live preview canvas appears shifted relative to the overall preview area. However, its position relative to the *video content* is calculated correctly, and it appears in the intended bottom-right corner of the video in the final downloaded file. This is a visual artifact of the preview scaling. 