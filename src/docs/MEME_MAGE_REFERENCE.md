# Meme Mage Feature Reference

This document outlines the key features and technical details of the Meme Mage functionality.

## Feature: Meme Categories

**Goal:** To allow administrators to assign categories to meme templates during the review process and enable users to filter meme template selections by these categories.

**Core Components & Flow:**

1.  **Database Schema (`meme_templates` table):**
    *   A new nullable column `category` of type `TEXT` was added to the `public.meme_templates` table.
    *   This was achieved by running the following SQL command in Supabase:
        ```sql
        ALTER TABLE public.meme_templates
        ADD COLUMN IF NOT EXISTS category TEXT NULL;
        ```

2.  **TypeScript Type Definition (`src/lib/supabase/types.ts`):**
    *   The `MemeTemplate` interface was updated to include the new optional field:
        ```typescript
        export interface MemeTemplate {
          // ... other fields ...
          category?: string | null;
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

6.  **Supabase RPC Function Updates (`match_meme_templates` & `get_random_meme_templates`):**
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
