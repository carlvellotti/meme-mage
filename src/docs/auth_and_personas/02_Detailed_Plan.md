# Auth & Personas - Detailed Plan (v1.1 - Incorporating Feedback)

This document provides detailed technical specifications for each chunk outlined in the Overall Plan.

**Quick Wins / Pre-computation:**

*   **Dependency Names:** Update imports to use latest Supabase helper names (`@supabase/auth-helpers-nextjs`).
*   **Unique Persona Name:** Add `UNIQUE (user_id, name)` constraint to `personas` table schema.
*   **Feedback States:** Confirm if the two-state feedback (`used`, `dont_use`) is sufficient long-term before implementing the table.

---

## Chunk 1: Authentication Setup

**Goal:** Establish user authentication using Supabase.

**Detailed Steps & Pseudocode:**

1.  **Supabase Configuration:**
    *   Ensure Authentication is enabled in Supabase dashboard (Settings > Authentication).
    *   Enable desired providers (start with Email, consider adding OAuth like GitHub/Google later).
    *   Whitelist OAuth redirect URLs in Supabase Auth settings if using OAuth.
    *   Add required environment variables to `.env.local`:
        ```
        NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
        NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
        # Required for server-side auth operations
        SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY 
        ```
    *   Disable "Confirm email" in Supabase Auth settings if immediate login after signup is desired.
2.  **Install Dependencies:**
    ```bash
    npm install @supabase/auth-helpers-nextjs @supabase/auth-ui-react @supabase/auth-ui-shared
    # OR yarn add ...
    ```
3.  **Create Supabase Clients (Helper Functions):**
    *   `src/lib/supabase/client.ts`: Create helper returning `createClientComponentClient()`.
    *   `src/lib/supabase/server.ts`: Create helper returning `createServerComponentClient({ cookies })`.
    *   `src/lib/supabase/route.ts`: Create helper returning `createRouteHandlerClient({ cookies })`.
    *   `src/lib/supabase/middleware.ts`: Create helper returning `createMiddlewareClient({ req, res })`.
4.  **Middleware Setup:**
    *   Create `src/middleware.ts`.
    *   Use middleware client helper to refresh sessions.
        ```typescript
        // src/middleware.ts
        // ... imports ...
        export async function middleware(req: NextRequest) { /* ... */ }
        export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api|auth).*)'] };
        ```
5.  **Client-Side Auth Provider:**
    *   Create `src/app/components/SupabaseProvider.tsx` using `createContext`, `useState`, `useEffect`, and `onAuthStateChange`.
    *   Wrap `src/app/layout.tsx` with `<SupabaseProvider>`. Provide basic loading state.
6.  **Login/Signup UI:**
    *   Create route `src/app/auth/page.tsx`.
    *   Use `@supabase/auth-ui-react` component (`Auth`). Customize `appearance` prop for theme consistency.
        ```tsx
        // Example snippet in src/app/auth/page.tsx
        <Auth
          supabaseClient={supabase}
          appearance={{ 
            theme: ThemeSupa,
            variables: { default: { /* ... color/font overrides ... */ } }
          }}
          providers={['email']} // Add others if enabled
          // Redirect handled by session check in useEffect
        />
        ```
    *   **Note:** A persistent TypeScript linter error `Type '"email"' is not assignable to type 'Provider'.` may appear for the `providers` prop. This seems related to type definitions in `@supabase/auth-ui-react` or its dependencies. Multiple attempts to resolve it by importing `Provider` types from various sources failed. The component functions correctly at runtime, so the current plan is to **ignore this specific linter error** and proceed. Further investigation may be needed if runtime issues arise or during library upgrades.
    *   Create `LogoutButton.tsx` component calling `supabase.auth.signOut()`.
    *   Integrate `LogoutButton` into `Navigation.tsx`, showing it conditionally based on session state.
7.  **Secure API Routes:**
    *   Modify existing API routes (`/api/templates/select`, `/api/ai/chat`) and plan for new ones.
    *   Use the Route Handler client helper (`createClient()`) at the start of each route handler.
    *   Fetch user session: `const { data: { user }, error: authError } = await supabase.auth.getUser();`
    *   Return 401 if `authError` or `!user`.
        ```typescript
        // Example snippet in an API route
        const supabase = createClient(); // Route helper uses cookies internally
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          // TODO: Log auth failure details
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = user.id;
        // ... rest of logic ...
        ```
    *   **Note:** Apply rate limiting specifically to auth-related API routes.

**Completion Checks:**

*   [X] Supabase Auth configured, providers whitelisted, env vars set. (Manual check)
*   [X] Auth helper packages installed, client helpers created. (Code check)
*   [X] Middleware configured, production cookie domain considered. (Code check)
*   [X] Client-side Provider setup. (Code check)
*   [X] Auth page uses `@supabase/auth-ui-react`, handles redirect. (Code check, Manual Test)
*   [X] Logout works. (Code check, Manual Test)
*   [X] Relevant API routes protected, return 401, extract `user.id`. (Code check, Manual Test)
*   [ ] Rate limiting considered/applied to auth routes. (Future task/Note)
*   [X] Auth failures are logged (basic setup - console warn added). (Code check)

---

## Chunk 2: Data Modeling & Backend APIs

**Goal:** Create DB tables and APIs for personas and feedback, managed via migrations.

**Detailed Steps & Pseudocode:**

1.  **Setup Migration Runner:**
    *   Install Supabase CLI (`npm install supabase --save-dev`).
    *   Initialize Supabase project locally (`supabase init`).
    *   Link to remote project (`supabase login`, `supabase link --project-ref <your-project-ref>`).
    *   Future schema changes will use `supabase migration new <name>` and `supabase db push`.
2.  **Create Initial Migration (`supabase/migrations/<timestamp>_init_personas_feedback.sql`):**
    *   Define reusable `trigger_set_timestamp()` function ONCE.
    *   Define `personas` and `meme_feedback` tables with constraints (unique name, unique feedback), RLS, indexes.
    ```sql
    -- Function to update `updated_at` timestamp
    CREATE OR REPLACE FUNCTION trigger_set_timestamp() /* ... */ END; $$ LANGUAGE plpgsql;

    -- Personas Table
    CREATE TABLE personas ( /* ... columns ... */ CONSTRAINT unique_user_persona_name UNIQUE (user_id, name) );
    ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow users to manage their own personas" ON personas FOR ALL /* ... */; 
    CREATE INDEX idx_personas_user_id ON personas(user_id);
    CREATE TRIGGER set_persona_timestamp BEFORE UPDATE ON personas FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

    -- Meme Feedback Table
    DO $$ BEGIN CREATE TYPE meme_feedback_status AS ENUM ('used', 'dont_use'); /* ... */ END $$;
    CREATE TABLE meme_feedback ( /* ... columns ... */ CONSTRAINT unique_user_persona_template UNIQUE (user_id, persona_id, template_id) );
    ALTER TABLE meme_feedback ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow users to manage their own feedback" ON meme_feedback FOR ALL /* ... */; 
    CREATE INDEX idx_meme_feedback_user_persona_template ON meme_feedback(user_id, persona_id, template_id);
    CREATE TRIGGER set_feedback_timestamp BEFORE UPDATE ON meme_feedback FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
    ```
    *   Apply migration: `supabase db push`.
3.  **API Input Validation (Zod):**
    *   Create schemas (e.g., in `src/lib/schemas.ts`) for `PersonaCreateSchema`, `PersonaUpdateSchema`, `FeedbackCreateSchema`.
4.  **Persona API (`src/app/api/personas/route.ts`):**
    *   Use Route Handler client, check auth, use `userId`.
    *   Standardize responses: `{ data: ... }` or `{ error: ... }`.
    *   **`GET`:** Fetch `personas` owned by `userId`. Return `{ data }` or `{ error }`.
    *   **`POST`:** Validate body with `PersonaCreateSchema`. Insert into `personas`. Return `{ data }` or `{ error }`.
5.  **Persona Detail API (`src/app/api/personas/[id]/route.ts`):**
    *   Use Route Handler client, check auth, use `userId`. Validate `params.id`.
    *   **`PUT`:** Validate body with `PersonaUpdateSchema`. Update `personas`. Return `{ data }` or `{ error }`.
    *   **`DELETE`:** Delete from `personas`. Return `{ data: { success: true }}` or `{ error }`.
6.  **Feedback API (`src/app/api/feedback/route.ts`):**
    *   Use Route Handler client, check auth, use `userId`.
    *   **`POST`:** Validate body with `FeedbackCreateSchema`. Upsert into `meme_feedback`. Return `{ data }` or `{ error }`.

**Completion Checks:**

*   [ ] Supabase CLI setup and initial migration created & applied.
*   [ ] `personas` table has unique name constraint, RLS, index, trigger.
*   [ ] `meme_feedback` table has RLS, optimized index, unique constraint, trigger. Cascade delete noted.
*   [ ] Zod schemas defined for API inputs.
*   [ ] `/api/personas` GET/POST implemented with auth, validation, standard responses.
*   [ ] `/api/personas/[id]` PUT/DELETE implemented with auth, validation, standard responses.
*   [ ] `/api/feedback` POST implemented with auth, validation, upsert, standard responses.
*   [ ] Consideration given to Edge runtime for API routes.

---

## Chunk 3: Frontend Integration

**Goal:** Connect backend APIs to the UI using a data fetching library and implement persona management via a modal.

**Detailed Steps & Pseudocode:**

1.  **Setup Data Fetching Library (e.g., SWR):**
    *   Install: `npm install swr` or `yarn add swr`.
    *   Configure global fetcher if needed (can reuse fetch logic or create a generic one).
2.  **Persona Management Modal (`src/app/components/PersonaManager.tsx`):**
    *   `\'use client\';` Component accepts `isOpen` and `onClose` props.
    *   Use a modal library (e.g., Headless UI Dialog, Radix Dialog, or a simple conditional render).
    *   Inside the modal:
        *   Use SWR hook `useSWR(\'/api/personas\', fetcher)` to get `data` (personas), `error`, `isLoading`, `mutate`.
        *   Display list of personas with Edit/Delete buttons.
        *   Include an \"Add New Persona\" form (or a button to toggle the form).
        *   Implement `addPersona`, `updatePersona`, `deletePersona` functions using `fetch` (`POST`, `PUT`, `DELETE`).
        *   Call SWR `mutate()` after successful operations to refresh the list within the modal.
        *   Handle loading/error states within the modal.
        *   Use `react-hot-toast` for operation feedback.
3.  **`MemeSelectorV2.tsx` Modifications:**
    *   `\'use client\';` Add state for managing modal visibility: `isPersonaModalOpen`, `setIsPersonaModalOpen`.
    *   Use `useSWR(\'/api/personas\', fetcher)` to get `personas`, `isLoadingPersonas`, `errorPersonas`.
    *   Replace \"Audience\" input with a \"Persona\" `<select>` dropdown populated from `personas` data. Handle loading state.
    *   Add a \"Manage Personas\" button next to the dropdown. `onClick` sets `isPersonaModalOpen(true)`.
    *   Render `<PersonaManager isOpen={isPersonaModalOpen} onClose={() => setIsPersonaModalOpen(false)} />`.
    *   **Zero Persona UX:** If `!isLoadingPersonas && personas?.length === 0`, consider showing a prominent message or automatically opening the `PersonaManager` modal.
    *   Require persona selection in `handleSubmit`, include `persona_id` in API call.
    *   Pass `personaId={selectedPersonaId}` prop to `MemeGenerator`.
4.  **`MemeGenerator.tsx` Modifications:**
    *   `\'use client\';` Accept `personaId?: string | null;` prop.
    *   Add state `isFeedbackLoading: boolean = false`.
    *   (Optional) Fetch persona name `useSWR(personaId ? \`/api/personas/${personaId}\` : null, fetcher)` if needed for button text.
    *   Add Feedback Buttons (e.g., ✔️ Used / 🛑 Don\'t Use) conditionally if `personaId` and `selectedTemplate` exist. Disable based on `isFeedbackLoading`.
    *   Implement `handleFeedback` function (`async (status: \'used\' | \'dont_use\') => { ... }`):
        *   Set `isFeedbackLoading(true)`.
        *   Call `POST /api/feedback` with `template_id`, `personaId`, `status`.
        *   Show toast on success/error.
        *   Set `isFeedbackLoading(false)` in `finally` block.

**Completion Checks:**

*   [ ] SWR (or similar) installed and configured.
*   [ ] `PersonaManager` modal component created, displays list, handles add/edit/delete using SWR.
*   [ ] `MemeSelectorV2` uses SWR, populates dropdown, handles zero-persona state.
*   [ ] \"Manage Personas\" button in `MemeSelectorV2` opens the `PersonaManager` modal.
*   [ ] `MemeSelectorV2` requires persona, passes `personaId` prop.
*   [ ] `MemeGenerator` accepts `personaId`, renders feedback buttons, handles loading state, calls API.

---

## Chunk 4: Template Filtering Update

**Goal:** Modify template selection RPC to exclude templates based on feedback.

**Detailed Steps & Pseudocode:**

1.  **Modify/Create Supabase RPC Functions (via Migration):**
    *   Update existing RPCs (`match_meme_templates`, `get_random_meme_templates`).
    *   Add `user_id_param UUID`, `persona_id_param UUID` parameters.
    *   Add `LEFT JOIN meme_feedback ... WHERE mf.id IS NULL` logic.
        ```sql
        -- Example structure for match_meme_templates
        CREATE OR REPLACE FUNCTION match_meme_templates(...) RETURNS TABLE (...) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY SELECT mt.* FROM meme_templates mt LEFT JOIN meme_feedback mf ON mt.id = mf.template_id AND mf.user_id = user_id_param AND mf.persona_id = persona_id_param WHERE mt.embedding <#> query_embedding < -match_threshold AND mf.id IS NULL ORDER BY ... LIMIT ...; END; $$;
        ```
    *   Apply migration: `supabase db push`.
2.  **Modify `/api/templates/select/route.ts`:**
    *   Check Auth (`userId`), validate body (optional `persona_id`).
    *   Call the **modified** RPC function with `userId` and `persona_id` (or `null`).
        ```typescript
        const { prompt, count = 3, persona_id } = validatedBody.data;
        // ... generate embedding ...
        const rpcName = prompt ? 'match_meme_templates' : 'get_random_meme_templates';
        const rpcParams = prompt ? { /* ... */ user_id_param: userId, persona_id_param: persona_id || null } : { /* ... */ user_id_param: userId, persona_id_param: persona_id || null };
        const { data, error } = await supabase.rpc(rpcName, rpcParams);
        // Handle shortfall if needed
        return Response.json({ templates: data || [] });
        ```

**Completion Checks:**

*   [ ] Migration created for RPC function updates (JOIN and WHERE clause).
*   [ ] Migration applied successfully.
*   [ ] `/api/templates/select` validates optional `persona_id`.
*   [ ] API calls the correct RPC with `userId` and `persona_id` (or `null`).
*   [ ] Logic/consideration added for handling template count shortfalls.
*   [ ] End-to-end test confirms filtering works per persona.

---

## Chunk 5: Observability & Ops (Ongoing)

**Goal:** Ensure the system is maintainable and issues can be diagnosed.

**Tasks:**

1.  **Logging:** Basic server-side logging, client-side error reporting.
2.  **Testing:** E2E tests (Playwright recommended).
3.  **Migrations:** Commit migration files, establish deploy process.

**Completion Checks:**

*   [ ] Basic server-side logging implemented for errors.
*   [ ] Plan/setup for E2E tests.
*   [ ] Migration files are version controlled. 