# Tech Specs: Step 8 - Testing and Refinement

## Objective

Ensure the entire new template review workflow (scraping -> AI analysis -> review table -> editing/approval/deletion) functions correctly, is robust, and provides a good user experience.

## Testing Strategy

1.  **Backend Scraper (`/api/scrape-reels`):**
    *   Test with single valid Reel URL. Verify template appears in `templates` table with `reviewed=false`, correct video/poster/source URLs, AI-generated name/instructions, and a valid embedding.
    *   Test with multiple valid Reel URLs.
    *   Test with an invalid Reel URL. Verify error is handled gracefully, logged, and doesn't stop processing of other URLs.
    *   Test with a Reel where the analysis API might fail (e.g., temporarily break the analysis API key). Verify template is still created with `reviewed=false` and placeholder name/instructions, and null/default embedding.
    *   Test with a Reel where embedding generation fails. Verify template is created with `reviewed=false`, AI name/instructions, but null/default embedding.

2.  **Backend Review APIs (`GET /api/templates?reviewed=false`, `PATCH /api/templates/:id`, `DELETE /api/templates/:id`):**
    *   Use tools (curl, Postman) or the frontend UI to test:
        *   Fetching unreviewed templates (verify correct data and filtering).
        *   Editing only `name`. Verify DB update and embedding *is not* changed.
        *   Editing only `instructions`. Verify DB update and embedding *is* recalculated and updated.
        *   Editing both `name` and `instructions`. Verify both DB fields update and embedding is recalculated/updated based on new instructions.
        *   Approving a template (`PATCH` with `{ reviewed: true }`). Verify `reviewed` flag is set to true in DB.
        *   Deleting a template (`DELETE`). Verify record is removed from DB.
        *   Test edge cases: invalid IDs, invalid request bodies, permissions.

3.  **Frontend Review UI (`UnreviewedTemplatesTable`):**
    *   Verify initial data loading, including loading state and error handling.
    *   Verify preview column shows poster image correctly, with video fallback.
    *   Test inline editing flows:
        *   Click Edit -> Input fields appear with current data.
        *   Modify Name/Instructions -> Click Cancel -> Changes are discarded, view resets.
        *   Modify Name/Instructions -> Click Save -> Success toast shown, changes persist in UI, editing closes.
        *   Modify Instructions -> Click Save -> Verify re-vectorization occurs (implicitly via API call).
    *   Test Approve button: Success toast shown, template disappears from the unreviewed list.
    *   Test Delete button: Confirmation dialog appears -> Click Cancel -> Nothing happens. Click OK -> Success toast shown, template disappears from the list.
    *   Test responsiveness and UI behavior with varying numbers of templates (0, few, many if pagination is implemented).

4.  **End-to-End Workflow:**
    *   Process a new Reel using the scraper form.
    *   Find the new template in the "Unreviewed" table.
    *   Edit its name and instructions, Save.
    *   Approve the template.
    *   Verify it no longer appears in the unreviewed list but *does* appear in the main `TemplateBrowser` (may require refresh).
    *   Delete another unreviewed template.
    *   Verify it is gone from the unreviewed list and cannot be found elsewhere.

5.  **Quality Assessment (AI Output):**
    *   Review the AI-generated `name` and `instructions` for a variety of scraped templates.
    *   Are the names concise and relevant?
    *   Is the analysis (instructions) accurate, insightful, and well-formatted?
    *   Are the hypothetical examples useful?
    *   Refine the analysis prompt (`getGeminiVideoAnalysisPrompt`) if quality is inconsistent.

## Potential Refinements

*   **Prompt Tuning:** Adjust the prompt for name/instruction generation based on quality assessment.
*   **UI/UX:** Improve loading states, error messages, table layout, or editing flow based on usability testing.
*   **Performance:** If the review table load time is slow with many items, ensure DB indexing on `reviewed` column and optimize API queries/pagination.
*   **Embedding Recalculation:** Add visual feedback (e.g., subtle loading indicator on Save) while embedding recalculation happens in the background via the API.
*   **Error Handling:** Enhance error details or user guidance for specific failure scenarios (e.g., analysis failure during scraping).

## Outcome

*   Confidence in the end-to-end functionality and robustness of the new template review workflow.
*   Verification of data integrity and correct state transitions.
*   Acceptable quality of AI-generated names and instructions.
*   A smooth and intuitive user experience for the template review process. 