# Meme Creation Flow V2 - Detailed Plan

This document breaks down each chunk from the Overall Plan, providing more detail, pseudocode, and completion checks.

---

## Chunk 1: Backend Template Fetching API

**Goal:** Create an API endpoint that returns 3 meme templates, either randomly selected or based on vector similarity to an optional user prompt.

**Proposed Endpoint:** `/api/templates/select` (Method: POST)

**Request Body:**

```typescript
interface TemplateSelectRequest {
  prompt?: string; // Optional user prompt for vector search
  audience?: string; // Optional audience (might be used later for filtering)
  count: number; // Number of templates to return (defaults to 3)
  isGreenscreenMode?: boolean; // Optional filter for greenscreen templates
}
```

**Response Body:**

```typescript
interface TemplateSelectResponse {
  templates: MemeTemplate[]; // Array of Supabase MemeTemplate objects
}

// Or for errors:
interface ErrorResponse {
  error: string;
}
```

**Detailed Steps & Pseudocode:**

1.  **Create API Route:** Set up the file structure: `src/app/api/templates/select/route.ts`.
2.  **Handle Request:**
    *   Parse the POST request body. Validate input (e.g., using Zod). Ensure `count` is a reasonable number.
    *   Extract `prompt`, `count`, `isGreenscreenMode`.
3.  **Conditional Logic (Prompt vs. No Prompt):**
    *   **If `prompt` exists:**
        *   Generate embedding for the `prompt` using OpenAI API.
        *   Call Supabase `match_meme_templates` RPC function with the embedding, desired `count`, and `isGreenscreenMode` filter if provided.
        *   Handle potential errors during embedding generation or Supabase call.
    *   **If `prompt` is null/empty:**
        *   Call Supabase function `get_random_meme_templates` with `count` and `isGreenscreenMode` filter if provided.
        *   *(Need to create this new `get_random_meme_templates` function in Supabase)*
        *   `get_random_meme_templates(limit_count INT, filter_greenscreen BOOLEAN)`:
            *   `SELECT * FROM meme_templates`
            *   `WHERE (filter_greenscreen IS NULL OR is_greenscreen = filter_greenscreen)`
            *   `ORDER BY random()`
            *   `LIMIT limit_count;`
        *   Handle potential errors during the Supabase call.
4.  **Format Response:**
    *   If successful, return a 200 OK response with `{ templates: [...] }`.
    *   If errors occurred, return appropriate error status (e.g., 400 for bad input, 500 for internal errors) with `{ error: "..." }`.

**Completion Checks:**

*   [x] New API route `/api/templates/select/route.ts` exists.
*   [x] New Supabase function `get_random_meme_templates` is created and works.
*   [x] Endpoint correctly handles POST requests with and without a `prompt` in the body.
*   [x] Endpoint returns 3 templates when no prompt is provided.
*   [x] Endpoint returns 3 relevant templates (based on vector search) when a prompt is provided.
*   [ ] Endpoint correctly filters by `isGreenscreenMode` if the flag is passed.
*   [x] Endpoint returns appropriate error responses for invalid input or internal failures.
*   [x] Input validation (e.g., Zod) is implemented.

---

## Chunk 2: Frontend Component Setup

**Goal:** Create the basic structure for the new V2 meme selection flow on a dedicated page.

**Detailed Steps:**

1.  **Create New Component File:** `src/app/components/MemeSelectorV2.tsx`.
2.  **Create New Page Route:** Add a new page, e.g., `src/app/meme-v2/page.tsx`. This page will import and render `MemeSelectorV2`.
    *   ```tsx
        // src/app/meme-v2/page.tsx
        import MemeSelectorV2 from '@/app/components/MemeSelectorV2';

        export default function MemeCreationV2Page() {
          return (
            <div className="container mx-auto p-4">
              <h1 className="text-2xl font-bold mb-4">Create Meme (V2)</h1>
              <MemeSelectorV2 />
            </div>
          );
        }
        ```
3.  **Basic Component Structure (`MemeSelectorV2.tsx`):**
    *   Import necessary React hooks (`useState`, `useEffect`, etc.).
    *   Define initial state variables:
        *   `audience` (string)
        *   `userPrompt` (string) - Note: Optional
        *   `isLoadingTemplates` (boolean)
        *   `isLoadingCaptions` (boolean)
        *   `fetchedTemplates` (MemeTemplate[] | null)
        *   `memeOptions` (MemeOption[] | null) - Define `MemeOption` interface (see below)
        *   `error` (string | null)
        *   `selectedFinalTemplate` (MemeTemplate | null)
        *   `selectedFinalCaption` (string | null)
    *   Define the `MemeOption` interface:
        ```typescript
        interface MemeOption {
          template: MemeTemplate;
          modelCaptions: {
            modelId: string; // e.g., 'claude-3-7-sonnet', 'gemini-2.5-pro', 'grok-llama3'
            captions: string[];
            error?: string;
            latency?: number; // Optional
          }[];
          // Maybe add status per model: 'pending', 'success', 'error'
        }
        ```
    *   Render a basic form with inputs for Audience (optional) and Prompt (optional), and a submit button.
    *   Initially, show the form. Hide it when loading or when results are shown.
    *   Render basic loading indicators based on `isLoadingTemplates` and `isLoadingCaptions`.
    *   Render error messages based on `error` state.
    *   Render a placeholder for where results will be displayed.
    *   Render the `MemeGenerator` component conditionally when `selectedFinalTemplate` and `selectedFinalCaption` are set.

**Completion Checks:**

*   [x] New file `src/app/components/MemeSelectorV2.tsx` exists.
*   [x] New route `src/app/meme-v2/page.tsx` exists and renders `MemeSelectorV2`.
*   [x] `MemeSelectorV2.tsx` has state variables for audience, prompt, loading states, templates, options, errors, and final selection.
*   [x] `MemeOption` interface is defined.
*   [x] Basic form for audience and prompt is rendered.
*   [x] Loading indicators are conditionally rendered.
*   [x] Error messages are conditionally rendered.
*   [x] Placeholder for results exists.
*   [x] `MemeGenerator` is conditionally rendered (it won't receive correct props yet).

**Implementation Notes:**
- Created a clean component structure with proper state management
- Implemented responsive UI with Tailwind CSS
- Added loading and error states with appropriate feedback
- Set up conditional rendering of different UI sections based on state

---

## Chunk 3: Frontend Logic - Template Fetching

**Goal:** Implement the call from `MemeSelectorV2` to the backend API created in Chunk 1.

**Detailed Steps (`MemeSelectorV2.tsx`):**

1.  **Create `handleSubmit` function:** This function will be triggered by the form submission.
2.  **Inside `handleSubmit`:**
    *   `e.preventDefault()`
    *   Clear previous results/errors: `setMemeOptions(null)`, `setError(null)`, `setFetchedTemplates(null)`.
    *   Set loading state: `setIsLoadingTemplates(true)`.
    *   Prepare request body:
        ```typescript
        const requestBody = {
          count: 3,
          audience: audience.trim() || undefined, // Send audience if provided
          prompt: userPrompt.trim() || undefined, // Send prompt ONLY if provided
          // Add isGreenscreenMode if needed later
        };
        ```
    *   Call the backend API:
        *   `fetch('/api/templates/select', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) })`
    *   **Handle Response:**
        *   If `response.ok`:
            *   Parse JSON: `const data = await response.json()`
            *   Update state: `setFetchedTemplates(data.templates)`
            *   Clear loading: `setIsLoadingTemplates(false)`
            *   *Trigger caption generation (Chunk 4)*
        *   If `!response.ok`:
            *   Parse error: `const errorData = await response.json()`
            *   Set error state: `setError(errorData.error || 'Failed to fetch templates')`
            *   Clear loading: `setIsLoadingTemplates(false)`
    *   **Error Handling:** Wrap the `fetch` call in a `try...catch` block to handle network errors. Set `error` state and clear loading in `catch`.

**Completion Checks:**

*   [x] `handleSubmit` function exists and is linked to the form.
*   [x] `fetch` call targets `/api/templates/select`.
*   [x] Request body correctly includes `count: 3` and conditionally includes `prompt` and `audience`.
*   [x] `isLoadingTemplates` state is correctly managed during the API call.
*   [x] On success, `fetchedTemplates` state is updated with the templates from the API response.
*   [x] On failure, `error` state is updated with an appropriate message.
*   [x] Network errors during fetch are caught.

**Implementation Notes:**
- Added proper error handling for both API errors and network errors
- Used try/catch/finally pattern to ensure loading state is always cleared
- Added data format conversion utility for compatibility with MemeGenerator component
- Restructured component for better conditional rendering based on state

---

## Chunk 4: Frontend Logic - Multi-Model Caption Generation

**Goal:** Once templates are fetched, trigger parallel calls to the unified AI API for each template and multiple models.

**Detailed Steps (`MemeSelectorV2.tsx`):**

1.  **Trigger after Template Fetch:** Modify the success path in `handleSubmit` (Chunk 3) after `setFetchedTemplates(data.templates)`:
    *   Call a new function, e.g., `generateCaptionsForAllTemplates(data.templates)`.
2.  **Create `generateCaptionsForAllTemplates` function:**
    *   Takes `templates: MemeTemplate[]` as input.
    *   Set loading state: `setIsLoadingCaptions(true)`.
    *   Clear previous options: `setMemeOptions(null)`.
    *   Define target models: `const models = ['anthropic-3-5', 'gemini-1.5-pro', 'grok-llama3']; // Example`
    *   Prepare array for all API call promises: `const captionPromises = [];`
    *   Initialize results structure:
        ```typescript
        const initialOptions: MemeOption[] = templates.map(t => ({
          template: t,
          modelCaptions: models.map(mId => ({ modelId: mId, captions: [], error: undefined }))
        }));
        setMemeOptions(initialOptions); // Set initial structure immediately for UI updates
        ```
    *   **Loop through templates and models:**
        *   For each `template` in `templates`:
            *   For each `modelId` in `models`:
                *   Construct the prompt using `getCaptionGenerationTestPrompt(audience)` and template details (`template.name`, `template.instructions`).
                *   Prepare the request body for `/api/ai/chat`:
                    ```typescript
                    const apiRequestBody = {
                      provider: modelId.split('-')[0], // 'anthropic', 'google', 'grok'
                      model: modelId, // Full ID like 'claude-3-5-sonnet-20241022'
                      messages: [{ role: 'user', content: /* constructed prompt */ }],
                      // Potentially add generation config if needed (temp, top_p)
                      json_mode: true // IMPORTANT: Ensure API expects/handles JSON output
                    };
                    ```
                *   Create the fetch promise:
                    ```typescript
                    const promise = fetch('/api/ai/chat', { /* POST request with apiRequestBody */ })
                      .then(async response => {
                        if (!response.ok) throw await response.json(); // Throw error object
                        const result = await response.json(); // Expecting { captions: ["...", "..."] }
                        return { templateId: template.id, modelId, captions: result.captions, error: null };
                      })
                      .catch(error => {
                        console.error(`Error fetching captions for ${template.name} from ${modelId}:`, error);
                        return { templateId: template.id, modelId, captions: [], error: error.error || error.message || 'Generation failed' };
                      });
                    ```
                *   Add promise to `captionPromises`.
    *   **Execute Promises:**
        *   Use `Promise.allSettled(captionPromises)` to wait for all calls, even if some fail.
    *   **Process Results:**
        *   Iterate through the `Promise.allSettled` results.
        *   For each result (whether fulfilled or rejected, using the structure returned in `then`/`catch`):
            *   Find the corresponding `template` and `model` entry in the `memeOptions` state.
            *   Update that entry with the `captions` or `error` message.
            *   **(Optimization):** Update state less frequently, perhaps batch updates or update after all promises settle. A simple approach is to build a new `updatedOptions` array based on `initialOptions` and the results, then call `setMemeOptions(updatedOptions)` once.
    *   Clear loading state: `setIsLoadingCaptions(false)`.

**Completion Checks:**

*   [x] `generateCaptionsForAllTemplates` function is called after templates are successfully fetched.
*   [x] `isLoadingCaptions` state is managed correctly.
*   [x] `memeOptions` state is initialized with placeholders for each template/model.
*   [x] Correct prompt using `getCaptionGenerationTestPrompt` is constructed for each API call.
*   [x] Parallel `fetch` calls are made to `/api/ai/chat` for each template/model combination.
*   [x] Request body for `/api/ai/chat` includes `provider`, `model`, `messages`, and `json_mode: true`.
*   [x] `Promise.allSettled` is used to handle responses.
*   [x] `memeOptions` state is correctly updated with captions or error messages for each model/template result.
*   [x] Failures for individual model calls don't prevent other results from being processed.

**Implementation Notes:**
- Implemented a robust multi-model caption generation system
- Added intelligent error handling for API responses and JSON parsing
- Designed the system to update the UI immediately with placeholders, then incrementally as results come in
- Added performance tracking with latency measurements
- Made the system resilient to individual model failures

---

## Chunk 5: Frontend UI - Displaying Results

**Goal:** Design and implement the UI in `MemeSelectorV2.tsx` to show the 3 templates and their multi-model captions.

**Detailed Steps (`MemeSelectorV2.tsx`):**

1.  **Conditional Rendering:** Only render the results section when `!isLoadingTemplates`, `!isLoadingCaptions`, and `memeOptions` is not null/empty.
2.  **Layout:** Use a grid or flex layout to display the 3 `MemeOption` items. A 3-column grid on desktop, stacking on mobile, might work well.
3.  **Template Card Component:** Create a sub-component (e.g., `TemplateResultCard.tsx`) or inline the structure for each `MemeOption`:
    *   Input props: `option: MemeOption`, `onSelectCaption: (template: MemeTemplate, caption: string) => void`.
    *   Display template name (`option.template.name`).
    *   Display template video (`option.template.video_url`) with controls.
    *   **Caption Display:** This is the key UI challenge. Options:
        *   **Tabs:** Have tabs for each `modelId` (`Anthropic`, `Google`, `Grok`). Each tab shows the list of captions from that model.
        *   **Grouped List:** List all captions grouped by `modelId`.
        *   **Combined List (with source):** Show all captions in one list, perhaps with a small badge indicating the source model.
        *   *(Decision needed)* Let's assume **Tabs** for now.
    *   **Tab Implementation:**
        *   Render Tab buttons for each `modelId` present in `option.modelCaptions`.
        *   Maintain local state within the card for the `activeModelTab`.
        *   Conditionally render the caption list based on the `activeModelTab`.
    *   **Caption List:**
        *   For the active model, check if `error` exists. If so, display the error message.
        *   If no error and `captions` array exists:
            *   Map through the `captions` array.
            *   Render each caption as a clickable button.
            *   Style the button clearly (e.g., like in `AIMemeSelector`).
            *   `onClick` handler for the button should call `props.onSelectCaption(option.template, caption)`.

**Completion Checks:**

*   [x] Results section is conditionally rendered based on loading states and `memeOptions`.
*   [x] Layout displays 3 templates/cards.
*   [x] Each card shows the template name and video.
*   [x] UI for displaying captions from multiple models is implemented (e.g., Tabs).
*   [x] Captions for the selected model are displayed as clickable buttons.
*   [x] Errors for specific models are displayed within their tab/section.
*   [x] Clicking a caption button triggers the `onSelectCaption` callback with the correct template and caption string.

**Implementation Notes:**
- Created a clean and intuitive TemplateResultCard component that displays captions by model
- Implemented a tab-based UI for switching between different AI models 
- Added visual indicators for loading states and errors within each model tab
- Used responsive grid layout for optimal display on different screen sizes
- Added performance metrics (latency) display next to each model name
- Ensured proper error states are shown when captions fail to load
- Used consistent styling for caption buttons that follows the app's design language

---

## Chunk 6: Integration with `MemeGenerator`

**Goal:** Ensure selecting a caption transitions the user to the `MemeGenerator` with the correct template, caption, and "Other Options" data.

**Detailed Steps (`MemeSelectorV2.tsx` & `MemeGenerator.tsx`):**

1.  **`MemeSelectorV2.tsx` - `handleSelectCaption`:**
    *   Create the `handleSelectCaption` function: `(template: MemeTemplate, caption: string) => { ... }`.
    *   Pass this function down as a prop to the `TemplateResultCard` (or wherever the caption buttons are rendered).
    *   Inside `handleSelectCaption`:
        *   Set the final selection state: `setSelectedFinalTemplate(template)`, `setSelectedFinalCaption(caption)`.
        *   *(Crucially)* Store the full `memeOptions` data structure in a state variable that will be passed to `MemeGenerator`, e.g., `setOptionsForGenerator(memeOptions)`.
2.  **`MemeSelectorV2.tsx` - Rendering `MemeGenerator`:**
    *   Conditionally render `MemeGenerator` when `selectedFinalTemplate` and `selectedFinalCaption` are set.
    *   Pass the required props:
        *   `initialTemplate={selectedFinalTemplate}`
        *   `initialCaption={selectedFinalCaption}`
        *   `initialOptions={optionsForGenerator}` // Pass the full multi-template/multi-model data
        *   `isGreenscreenMode={...}` // Pass the relevant mode if tracked
        *   `onToggleMode={...}` // Pass the relevant handler if tracked
        *   `onBack={() => { setSelectedFinalTemplate(null); setSelectedFinalCaption(null); }}` // Handler to return to the V2 selector view
3.  **`MemeGenerator.tsx` - Prop Types:**
    *   Update the `MemeGeneratorProps` interface. The `initialOptions` prop type needs to change from `SelectedMeme | null` (which was based on the V1 AI response structure) to `MemeOption[] | null` (the structure from V2).
        ```typescript
        // In MemeGenerator.tsx
        import { MemeOption } from './MemeSelectorV2'; // Adjust import path if needed

        interface MemeGeneratorProps {
          // ... other props
          initialOptions?: MemeOption[] | null; // Updated type
        }
        ```
4.  **`MemeGenerator.tsx` - Handling `initialOptions`:**
    *   Locate the code block that renders the "Other Options" section (currently maps over `generatedOptions.templates`).
    *   Update this logic to map over the new `initialOptions` (which is `MemeOption[]`).
    *   For each `option` in `initialOptions`:
        *   Display the template name (`option.template.name`) and video (`option.template.video_url`).
        *   **Display Captions:** You need to decide how to show the captions from multiple models here. Simplest might be to flatten the list:
            *   Iterate through `option.modelCaptions`.
            *   For each model, iterate through its `captions`.
            *   Display each caption as a button. Maybe add a small indicator of the source model?
            *   The `onClick` for these buttons should call `handleCreateFromTemplate(option.template, caption, initialOptions)`. *Note: `handleCreateFromTemplate` might need adjustment if it relies on the old `SelectedMeme` structure internally.* Check its usage.
        *   Ensure the currently selected template/caption combination is visually distinct or excluded from the "Other Options" display.

**Completion Checks:**

*   [x] `handleSelectCaption` function correctly sets `selectedFinalTemplate` and `selectedFinalCaption` in `MemeSelectorV2`.
*   [x] Full `memeOptions` data is stored to be passed to `MemeGenerator`.
*   [x] `MemeGenerator` is rendered conditionally with the correct `initialTemplate`, `initialCaption`, `initialOptions` (new structure), and `onBack` props.
*   [x] `MemeGeneratorProps` interface in `MemeGenerator.tsx` is updated for `initialOptions`.
*   [x] "Other Options" section in `MemeGenerator.tsx` correctly maps over the new `MemeOption[]` structure.
*   [x] Captions from all models for other templates are displayed and clickable in "Other Options".
*   [x] Clicking an "Other Option" caption correctly updates the `MemeGenerator` state using `handleCreateFromTemplate` (check if `handleCreateFromTemplate` needs updates).
*   [x] The `onBack` button in `MemeGenerator` correctly returns the user to the `MemeSelectorV2` view.

**Implementation Notes:**
- Implemented a data format conversion utility to translate between V2's MemeOption[] and MemeGenerator's expected SelectedMeme format
- Created a clean handleSelectCaption function that properly sets the selected template and caption
- Set up proper back navigation from MemeGenerator to MemeSelectorV2
- Ensured all captions from all models are flattened and available in the "Other Options" section

---

## Chunk 7: Testing & Refinement

**Goal:** Ensure the new flow is robust, handles errors gracefully, and provides a good user experience.

**Detailed Steps:**

1.  **End-to-End Testing (No Prompt):**
    *   Load the `/meme-v2` page.
    *   Leave the prompt blank, optionally enter an audience.
    *   Submit.
    *   Verify: Loading states appear correctly. 3 *random* templates are displayed. Captions from all target models appear under each template (or errors are shown).
    *   Select a caption. Verify `MemeGenerator` loads with the correct template/caption. Verify "Other Options" shows the other 2 templates with their captions.
    *   Test the `onBack` button.
2.  **End-to-End Testing (With Prompt):**
    *   Load the `/meme-v2` page.
    *   Enter a prompt and optionally an audience.
    *   Submit.
    *   Verify: Loading states appear correctly. 3 *relevant* templates (based on vector search) are displayed. Captions load correctly.
    *   Select a caption and test `MemeGenerator` integration as above.
3.  **Error Handling Tests:**
    *   Simulate API failure during template fetching (e.g., network error, backend 500). Verify an error message is shown to the user.
    *   Simulate API failure for *some* caption generation calls (e.g., one model fails). Verify results from successful models are still shown, and an error message appears for the failed model.
    *   Simulate API failure for *all* caption generation calls. Verify appropriate error handling.
    *   Test with invalid inputs (though backend validation should catch most).
4.  **UI/UX Refinement:**
    *   Review the clarity of the multi-model caption display. Is it easy to compare? Is it overwhelming? Adjust based on testing. (Initial implementation looks good, further testing needed).
    *   Check responsiveness on different screen sizes. (Basic responsiveness implemented with wrapping columns).
    *   Ensure loading states provide good feedback. (Implemented).
5.  **Code Review & Cleanup:**
    *   Remove console logs used for debugging.
    *   Ensure consistent code style.
    *   Add comments for complex logic if necessary.
6.  **(Optional) Logging:** Add basic client-side logging for API call durations or errors if needed for monitoring.

**Completion Checks:**

*   [ ] Flow works correctly end-to-end both with and without a user prompt.
*   [ ] Template selection logic (random vs. vector) functions as expected.
*   [ ] Multi-model caption generation and display function correctly.
*   [ ] Integration with `MemeGenerator` (initial load and "Other Options") is verified.
*   [ ] Error states (template fetch fail, partial caption fail, full caption fail) are handled gracefully with user feedback.
*   [ ] UI is responsive and provides a clear user experience.
*   [ ] Code is cleaned up and potentially reviewed. 

**Implementation Notes:**
- The core functionality is built and visually refined based on feedback.
- Error handling has been implemented for API calls and parsing.
- Responsiveness has been addressed by allowing columns to wrap.
- Further end-to-end testing and specific error simulation are the next steps for this chunk. 