# Tech Spec: Mark as Duplicate Feature for Meme Templates

**Date:** April 30, 2025

**Status:** Proposed

## 1. Goals

- Provide a mechanism for reviewers to flag meme templates that are duplicates of existing reviewed templates.
- Prevent duplicate templates from cluttering the review queue (`ReviewTemplatesTable.tsx`).
- Avoid implementing a full merge/deduplication feature at this time, opting for a simpler flagging system.

## 2. Implementation Details

### 2.1. Database Schema Changes (`meme_templates` table)

- **Add Column:** Introduce a new boolean column named `is_duplicate`.
    - **Type:** `BOOLEAN`
    - **Default Value:** `FALSE`
    - **Nullable:** `FALSE` (or `TRUE` with `DEFAULT FALSE`)
- **Migration:** A new Supabase migration file will be created to apply this schema change.

### 2.2. Backend API Modifications

- **`PATCH /api/templates/[id]` (`src/app/api/templates/[id]/route.ts`)**
    - **Request Body:** Modify the Zod schema (or equivalent validation) to optionally accept an `is_duplicate: boolean` field.
    - **Logic:** If `is_duplicate` is received and is `true`, update the corresponding `meme_templates` record in the database, setting the `is_duplicate` column to `true`.
- **`GET /api/templates` (`src/app/api/templates/route.ts`)**
    - **Query Logic:** When fetching templates specifically for the review queue (i.e., when the `reviewed=false` query parameter is present), modify the Supabase query (likely using `.eq('reviewed', false)`) to *also* include `.eq('is_duplicate', false)`.
    - **Result:** This ensures the API only returns templates that are *not* reviewed AND *not* marked as duplicates.

### 2.3. Frontend Changes (`src/app/components/ReviewTemplatesTable.tsx`)

- **UI:**
    - Add a new button labeled "Duplicate" within the "Actions" column (`<td>`) for each template row in the table. Place it alongside the existing "Edit", "Approve", and "Delete" buttons.
    - Style the button appropriately (e.g., using a distinct color like yellow or orange, TBD).
- **Functionality:**
    - **New Handler:** Implement an `async` function `handleMarkAsDuplicate(templateId: string)`.
        - This function will make a `PATCH` request to the `/api/templates/[templateId]` endpoint.
        - The request body will be `JSON.stringify({ is_duplicate: true })`.
        - Standard `fetch` headers (`'Content-Type': 'application/json'`) will be used.
    - **State Update:** On a successful API response (e.g., `response.ok`), update the local component state by removing the marked template from the `unreviewedTemplates` array:
      ```typescript
      setUnreviewedTemplates(prev => prev.filter(t => t.id !== templateId));
      ```
    - **User Feedback:**
        - Use `react-hot-toast` to display a success message (e.g., `Template "${template.name}" marked as duplicate.`) upon successful completion.
        - Display an error toast if the API call fails, including the error message from the API response if available.
    - **Button Integration:** Attach the `handleMarkAsDuplicate` function to the `onClick` event of the new "Duplicate" button, passing the specific `template.id`.

## 3. Future Considerations (Out of Scope for this Implementation)

- **Duplicate Detection:** Implementing automated detection of potential duplicates based on video hash, name similarity, or other metrics.
- **Merge Functionality:** Providing a UI to merge a duplicate template's metadata (like source URL or uploader info) into the original template before deletion/marking.
- **Viewing Duplicates:** A separate interface to view templates that have been marked as duplicates.

## 4. Acceptance Criteria

- A new `is_duplicate` column exists in the `meme_templates` table.
- The "Duplicate" button appears in the actions column of the `ReviewTemplatesTable`.
- Clicking the "Duplicate" button successfully sends a PATCH request to the backend API.
- The backend API correctly updates the `is_duplicate` flag in the database for the specified template.
- Templates marked as duplicate no longer appear in the `ReviewTemplatesTable` after a refresh or upon initial load.
- Success and error toasts provide appropriate user feedback. 