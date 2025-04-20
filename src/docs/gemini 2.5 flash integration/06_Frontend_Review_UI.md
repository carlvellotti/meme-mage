# Tech Specs: Step 6 - Frontend Review UI

## Objective

Create a new frontend component (e.g., `UnreviewedTemplatesTable`) to display templates marked as `reviewed = false` and allow admin users to edit, approve, or delete them.

## Related Files

*   `src/app/admin/page.tsx` (Or relevant admin page where this table will be placed)
*   `src/app/components/UnreviewedTemplatesTable.tsx` (New component to create)
*   `src/app/components/TemplateBrowser.tsx` (For potential style/component reuse)
*   `src/lib/supabase/types.ts` (May need interface updates)

## Tasks

1.  **Create `UnreviewedTemplatesTable.tsx` Component:**
    *   **Props:** Define props, potentially including `onTemplateUpdate` or similar callbacks if needed by the parent page.
    *   **State:** Manage component state:
        *   `unreviewedTemplates`: Array to hold fetched templates.
        *   `isLoading`: Loading state for initial fetch.
        *   `error`: Error messages.
        *   `editingTemplateId`: ID of the template currently being edited inline (or null).
        *   `editedName`, `editedInstructions`: State to hold inline edit values.
        *   Pagination state (`page`, `hasMore`, etc.) if implementing pagination.

2.  **Fetch Data:**
    *   In `useEffect`, fetch data from the `GET /api/templates?reviewed=false` endpoint.
    *   Handle loading and error states during fetch.
    *   Implement logic for fetching subsequent pages if using pagination (e.g., Intersection Observer or Load More button).

3.  **Render Table Structure:**
    *   Create a table (`<table>`) or use divs styled as a table.
    *   **Columns:**
        *   **Preview:** Display `poster_url` as an image (`<img>`). If `poster_url` is missing, display the `video_url` in a small `<video>` element as a fallback.
        *   **Name:** Display `template.name`. If `editingTemplateId === template.id`, render an `<input type="text">` bound to `editedName`.
        *   **Instructions:** Display `template.instructions` (truncated potentially, with full view on hover/click or during edit). If `editingTemplateId === template.id`, render a `<textarea>` bound to `editedInstructions`.
        *   **Source:** Display `template.instagram_url` as a clickable link.
        *   **Actions:** Contains the Edit/Save/Cancel/Approve/Delete buttons.

4.  **Implement Inline Editing:**
    *   **Edit Button:**
        *   Visible when not editing.
        *   `onClick`: Sets `editingTemplateId` to the row's `template.id`, populates `editedName` and `editedInstructions` from the current template data.
    *   **Save Button:**
        *   Visible when `editingTemplateId === template.id`.
        *   `onClick`: Calls a handler function `handleSave(template.id)`. Disables button during save.
    *   **Cancel Button:**
        *   Visible when `editingTemplateId === template.id`.
        *   `onClick`: Resets `editingTemplateId` to null, discards `editedName`/`editedInstructions` changes.

5.  **Implement Action Handlers:**
    *   **`handleSave(templateId)`:**
        *   Makes a `PATCH` request to `/api/templates/[templateId]`.
        *   **Body:** `{ name: editedName, instructions: editedInstructions }`.
        *   Handles API response (success/error toasts).
        *   On success: Updates the local `unreviewedTemplates` state with the new name/instructions, sets `editingTemplateId` to null.
    *   **`handleApprove(templateId)`:**
        *   Makes a `PATCH` request to `/api/templates/[templateId]`.
        *   **Body:** `{ reviewed: true }`.
        *   Handles API response (success/error toasts).
        *   On success: Removes the template from the local `unreviewedTemplates` state (as it's no longer unreviewed).
    *   **`handleDelete(templateId)`:**
        *   Show a confirmation dialog (`window.confirm` or a modal).
        *   If confirmed, makes a `DELETE` request to `/api/templates/[templateId]`.
        *   Handles API response (success/error toasts).
        *   On success: Removes the template from the local `unreviewedTemplates` state.

6.  **Integrate into Admin Page:**
    *   Import and render the `<UnreviewedTemplatesTable />` component on the appropriate admin page (e.g., `/admin`).

## Key Considerations

*   **Styling:** Reuse existing styles from `TemplateBrowser` or admin components for consistency.
*   **State Management:** Keep state management within the component simple unless shared state is required with other admin components.
*   **User Experience:** Provide clear loading indicators, error messages (toasts), and confirmation dialogs for destructive actions (delete).
*   **Fallback Previews:** Ensure the video fallback for the preview column works correctly.
*   **Text Area Sizing:** Consider auto-resizing for the instruction textarea during editing.

## Outcome

*   A new table/component exists on an admin page displaying only unreviewed templates.
*   Admin users can view template details, including video/poster previews.
*   Admin users can inline edit the name and instructions, saving changes which triggers re-vectorization.
*   Admin users can approve templates, removing them from the unreviewed list.
*   Admin users can delete templates permanently after confirmation. 