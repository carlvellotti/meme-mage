# Auth & Personas Implementation Plan (v1.1 - Incorporating Feedback)

## Project Goals

1.  **Implement User Authentication:** Allow users to log in and have their data associated with their account.
2.  **Introduce Personas:** Enable the creation and management of distinct audience personas, ensuring unique names per user.
3.  **Implement Meme Feedback:** Allow users to mark meme *templates* as "used" or "don't use" for a specific persona.
4.  **Filter Template Selection:** Prevent templates marked with feedback for the selected persona from appearing in future searches for that persona, handling potential result shortfalls.

## Implementation Chunks

This project will be completed sequentially in the following chunks:

1.  **Chunk 1: Authentication Setup**
    *   Configure Supabase Authentication (Email + potential future OAuth providers).
    *   Set up Supabase auth helper libraries (`@supabase/auth-helpers-nextjs`) for server/client/middleware.
    *   Implement middleware for session management & configure production cookie domain.
    *   Create Login UI (`@supabase/auth-ui-react`), Logout functionality, and potentially a client-side context provider.
    *   Secure API endpoints, extract user ID, and apply rate limiting to auth routes.

2.  **Chunk 2: Data Modeling & Backend APIs**
    *   Set up a migration runner (e.g., Supabase CLI) and manage schema changes via migrations.
    *   Create `personas` table with unique name constraint per user, RLS, index, and `updated_at` trigger.
    *   Create `meme_feedback` table with RLS, unique constraint, index optimized for filtering, and `updated_at` trigger. Note `ON DELETE CASCADE` implications.
    *   Develop authenticated/validated CRUD API endpoints for personas (`/api/personas`, `/api/personas/[id]`) using Zod and standard response shapes.
    *   Develop authenticated/validated API endpoint for feedback (`/api/feedback`) using upsert.
    *   Consider Edge runtime for API routes.

3.  **Chunk 3: Frontend Integration**
    *   Integrate a data fetching library (SWR or React Query) for managing client-side state.
    *   Create a `PersonaManager` UI component (using SWR/Query) for CRUD operations, accessible via modal.
    *   Modify `MemeSelectorV2`:
        *   Fetch personas (SWR/Query), handle zero-persona state.
        *   Replace audience input with persona `<select>`.
        *   Pass `personaId` to `MemeGenerator`.
    *   Modify `MemeGenerator`:
        *   Accept `personaId`.
        *   Display feedback buttons (with icons, proper disabling).
        *   Call feedback API on click.

4.  **Chunk 4: Template Filtering Update**
    *   Modify `/api/templates/select` to accept `persona_id`.
    *   Update/Create Supabase RPC functions (`match_meme_templates`, `get_random_meme_templates`) via migrations to perform filtering (`LEFT JOIN ... WHERE feedback.id IS NULL`).
    *   Call appropriate RPC from the API route, passing `userId` and `persona_id`.
    *   Add logic to handle potential result shortfalls if a strict count is needed.

5.  **Chunk 5: Observability & Ops (Ongoing)**
    *   Implement basic logging for important events and errors (especially auth failures).
    *   Create end-to-end tests (Playwright/Cypress) for critical user flows.
    *   Ensure all DB changes are managed via committed migration files. 