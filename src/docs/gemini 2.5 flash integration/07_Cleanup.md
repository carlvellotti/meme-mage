# Tech Specs: Step 7 - Cleanup

## Objective

Remove the now-obsolete `unprocessed_templates` table and related code components from the project.

## Related Files/Components

*   `src/app/admin/page.tsx` (Or relevant admin page that previously showed the unprocessed table)
*   `src/app/components/UnprocessedTemplatesTable.tsx` (Component to delete)
*   `src/app/api/unprocessed-templates/route.ts` (Or similar API endpoint used by the old table - to delete)
*   Database schema (Remove `unprocessed_templates` table)
*   Any other files exclusively importing or using `UnprocessedTemplatesTable` or its API.

## Tasks

1.  **Remove Frontend Component Usage:**
    *   Locate where `<UnprocessedTemplatesTable />` was rendered (likely the admin page).
    *   Remove the component import and rendering logic.

2.  **Delete Frontend Component File:**
    *   Delete the file `src/app/components/UnprocessedTemplatesTable.tsx`.

3.  **Delete Backend API Route:**
    *   Identify the API route(s) used solely by `UnprocessedTemplatesTable` (e.g., fetching unprocessed templates, potentially deleting them).
    *   Delete the corresponding API route file(s) (e.g., `src/app/api/unprocessed-templates/route.ts`).

4.  **Drop Database Table:**
    *   Connect to the Supabase database (or use a migration tool).
    *   Execute the SQL command: `DROP TABLE IF EXISTS unprocessed_templates;`
    *   **Caution:** Ensure no critical data needs to be preserved before dropping the table. Verify that the migration script (if created for Step 4) successfully processed all necessary items or that remaining items are okay to discard.

5.  **Code Search & Cleanup:**
    *   Perform a project-wide search for `UnprocessedTemplatesTable`, `unprocessed_templates`, and related terms.
    *   Remove any lingering imports, type definitions, or utility functions that are no longer needed.

## Outcome

*   The old unprocessed templates workflow is completely removed from the codebase.
*   The `unprocessed_templates` database table is deleted.
*   The project is cleaner and only contains the new review-based template management system. 