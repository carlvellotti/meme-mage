# Tech Specs: Step 5 - Backend Review APIs

## Objective

Create the necessary API endpoints to support the frontend "Unreviewed Templates" table functionality, including fetching, editing (name/instructions), saving, approving, and deleting templates.

## Related Files

*   `src/app/api/templates/route.ts` (Potentially for GET)
*   `src/app/api/templates/[id]/route.ts` (Likely location for PATCH and DELETE)
*   `src/lib/supabase/admin.ts` or equivalent (For database interactions)
*   `src/lib/utils/embeddingUtils.ts` (For re-vectorization on edit)

## Tasks

1.  **Fetch Unreviewed Templates Endpoint:**
    *   **Endpoint:** `GET /api/templates?reviewed=false` (or create `GET /api/templates/unreviewed`)
    *   **Logic:**
        *   Query the `templates` table using the Supabase admin client.
        *   Filter results where `reviewed IS DISTINCT FROM TRUE` (or `reviewed = false`, depending on how NULLs are handled/defaulted).
        *   Select relevant columns needed for the review table (id, name, instructions, video_url, poster_url, instagram_url, etc.).
        *   Implement pagination (e.g., using query parameters `?page=1&limit=20`) if the number of unreviewed templates could become large.
        *   Return the list of unreviewed templates.
    *   **Security:** Ensure this endpoint requires appropriate admin/editor permissions.

2.  **Update/Approve Template Endpoint:**
    *   **Endpoint:** `PATCH /api/templates/[id]`
    *   **Request Body:** Accept a JSON object containing optional fields:
        *   `name?: string`
        *   `instructions?: string`
        *   `reviewed?: boolean` (Specifically `true` for approval)
    *   **Logic:**
        *   Validate the request body and the `:id` parameter.
        *   Fetch the existing template data.
        *   Prepare an update object for the Supabase client based on the fields provided in the request body.
        *   **Re-vectorization Trigger:** If the `instructions` field is present and different from the existing instructions:
            *   Call the embedding generation function using the *new* `instructions` text.
            *   Add the new `embedding` vector to the update object.
            *   Handle potential errors during embedding generation.
        *   Perform the `update` operation on the `templates` table using the Supabase admin client for the given `:id`.
        *   Handle database update errors.
        *   Return the updated template data or a success status.
    *   **Security:** Ensure this endpoint requires appropriate admin/editor permissions.
    *   **Note:** This single endpoint handles both saving edits (updating `name`/`instructions`, re-vectorizing) and approving (setting `reviewed` to `true`).

3.  **Delete Template Endpoint:**
    *   **Endpoint:** `DELETE /api/templates/[id]`
    *   **Logic:**
        *   Validate the `:id` parameter.
        *   Perform the `delete` operation on the `templates` table using the Supabase admin client where `id` matches `:id`.
        *   Handle database deletion errors.
        *   Return a success status (e.g., 204 No Content).
    *   **Security:** Ensure this endpoint requires appropriate admin/editor permissions.

## Key Considerations

*   **Consolidated PATCH:** Using a single `PATCH` endpoint for both edits and approval simplifies the API surface but requires careful handling of optional fields and the re-vectorization trigger.
*   **Embedding Logic:** Ensure the embedding generation logic is accessible and efficiently callable within the `PATCH` endpoint context.
*   **Permissions:** All these endpoints modify core template data and must be protected by robust authentication and authorization checks (e.g., check if the logged-in user is an admin).
*   **Error Handling:** Provide clear error responses for validation failures, database errors, or embedding errors.

## Outcome

*   Backend APIs are available to fetch unreviewed templates.
*   Backend API is available to update template names and instructions, triggering re-vectorization when instructions change.
*   Backend API allows setting a template's status to `reviewed = true`.
*   Backend API allows permanently deleting a template.
*   These APIs provide the necessary support for the frontend review table interactions. 