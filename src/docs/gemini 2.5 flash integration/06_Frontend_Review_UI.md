# Tech Specs: Step 6 - Frontend Review UI

## Objective

Create a new frontend component (`UnreviewedTemplatesTable`) to display templates marked as `reviewed = false` and allow admin users to view, approve, delete, or edit them via a modal.

## Related Files

*   `src/app/admin/page.tsx` (Or relevant admin page where this table will be placed)
*   `src/app/upload/page.tsx` (Actual integration location)
*   `src/app/components/UnreviewedTemplatesTable.tsx` (New component created)
*   `src/app/components/TemplateBrowser.tsx` (For potential style/component reuse)
*   `src/lib/supabase/types.ts` (Interface for `MemeTemplate` used)
*   `src/app/api/templates/route.ts` (`GET` endpoint used)
*   `src/app/api/templates/[id]/route.ts` (`PATCH` and `DELETE` endpoints used)

## Implementation Summary

1.  **Created `UnreviewedTemplatesTable.tsx` Component:**
    *   **State:** Manages component state:
        *   `unreviewedTemplates`: Array holding fetched templates.
        *   `isLoading`: Loading state for initial fetch.
        *   `error`: Error messages.
        *   State for video preview modal (`isModalOpen`, `modalVideoUrl`).
        *   State for edit modal (`isEditModalOpen`, `currentEditingTemplate`, `editModalInitialName`, `editModalInitialInstructions`).

2.  **Fetched Data:**
    *   In `useEffect`, fetches data from the `GET /api/templates?reviewed=false` endpoint.
    *   Handles loading and error states, ensuring API response is an array.

3.  **Rendered Table Structure:**
    *   Uses `<table>` with Tailwind CSS classes similar to `UnprocessedTemplatesTable` for dark mode styling.
    *   **Columns:**
        *   **Preview:** Displays `poster_url` as an image or indicates video presence. Clickable to open a video preview modal (`handlePreviewClick`, `closeModal`).
        *   **Name:** Displays `template.name` (allows text wrapping).
        *   **Instructions:** Displays `template.instructions` (truncated using `line-clamp-4` with full text on hover).
        *   **Source:** Displays `template.original_source_url` as a clickable link.
        *   **Actions:** Contains "Edit", "Approve", and "Delete" buttons.

4.  **Implemented Edit Modal:**
    *   Defined an internal `EditTemplateModal` component.
    *   **"Edit" Button:** Opens the `EditTemplateModal`, passing the current template's name and instructions.
    *   **Modal Content:** Includes input for "Name" and a larger `textarea` for "Instructions". The modal is larger and taller by default.
    *   **Modal "Save Changes" Button:** Calls `handleSaveModal`, which sends a `PATCH` request to `/api/templates/[templateId]` containing only the changed fields (name and/or instructions). Triggers re-vectorization on the backend if instructions change.
    *   **Modal "Cancel" Button / Overlay Click:** Closes the modal, discarding unsaved changes.

5.  **Implemented Action Handlers:**
    *   **`handleSaveModal(templateId, newName, newInstructions)`:**
        *   Makes `PATCH` request to `/api/templates/[templateId]`.
        *   **Body:** Includes only `{ name: newName }`, `{ instructions: newInstructions }`, or both, depending on what changed.
        *   Handles API response (success/error toasts using `react-hot-toast`).
        *   On success: Updates the local `unreviewedTemplates` state with the data returned from the API.
    *   **`handleApprove(templateId)`:**
        *   Makes `PATCH` request to `/api/templates/[templateId]`.
        *   **Body:** `{ reviewed: true }`.
        *   Handles API response (success/error toasts).
        *   On success: Removes the template from the local `unreviewedTemplates` state. (Confirmation prompt removed).
    *   **`handleDelete(templateId)`:**
        *   Shows a confirmation dialog (`window.confirm`).
        *   If confirmed, makes a `DELETE` request to `/api/templates/[templateId]`.
        *   Handles API response (success/error toasts).
        *   On success: Removes the template from the local `unreviewedTemplates` state.

6.  **Integrated into Upload Page:**
    *   Imported and rendered the `<UnreviewedTemplatesTable />` component on `/upload` page, below the `TemplateUploader`.

## Key Decisions & Changes from Initial Spec

*   **Consolidated Editing:** Moved editing for both `name` and `instructions` into a single, larger modal (`EditTemplateModal`) instead of inline editing for a better user experience with potentially long instruction text.
*   **Styling:** Matched styling closely with `UnprocessedTemplatesTable` for visual consistency in the dark theme.
*   **API Response Handling:** Ensured frontend correctly handles the exact JSON structure returned by the API routes (initially required fixing API return structure and frontend parsing for fetch and save).
*   **State Updates:** Implemented immediate local state updates upon successful Save/Approve/Delete actions to avoid requiring a page refresh.
*   **Confirmation Removal:** Removed the confirmation dialog for the "Approve" action based on user request.

## Outcome

*   A new table exists on the `/upload` page displaying only unreviewed templates (`reviewed=false`).
*   Admin users can view template details, including clickable video previews.
*   Admin users can open a modal to edit the name and instructions, saving changes which triggers re-vectorization if instructions are modified. Changes are reflected immediately in the table.
*   Admin users can approve templates without confirmation, removing them from the unreviewed list immediately.
*   Admin users can delete templates permanently after confirmation, removing them from the list immediately. 