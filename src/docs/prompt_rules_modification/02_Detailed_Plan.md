# Caption Rules Modification - Detailed Plan

This plan outlines the technical steps for implementing the user-managed caption rules feature.

---

## Chunk 1: Data Modeling & Backend APIs

**Goal:** Create the database structure and API endpoints for managing custom caption rule sets.

**Detailed Steps & Pseudocode:**

1.  **Setup Migration Runner (if not already done):**
    *   Ensure Supabase CLI is installed and linked to the project.
2.  **Create Migration (`supabase/migrations/<timestamp>_init_caption_rules.sql`):**
    *   Define `caption_generation_rules` table.
    ```sql
    -- Ensure the timestamp function exists (create if not)
    -- CREATE OR REPLACE FUNCTION trigger_set_timestamp() ... ;

    -- Caption Generation Rules Table
    CREATE TABLE caption_generation_rules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
        name text NOT NULL,
        rules_text text NOT NULL, -- Stores the user-defined rules content
        created_at timestamptz DEFAULT now() NOT NULL,
        updated_at timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT unique_user_ruleset_name UNIQUE (user_id, name)
    );

    -- Indexes
    CREATE INDEX idx_caption_rules_user_id ON caption_generation_rules(user_id);

    -- RLS
    ALTER TABLE caption_generation_rules ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow users to manage their own caption rules"
        ON caption_generation_rules
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);

    -- Trigger for updated_at
    CREATE TRIGGER set_rules_timestamp
        BEFORE UPDATE ON caption_generation_rules
        FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

    COMMENT ON TABLE caption_generation_rules IS 'Stores user-defined sets of key rules for meme caption generation.';
    COMMENT ON COLUMN caption_generation_rules.rules_text IS 'The specific text defining the key rules provided by the user.';
    ```
    *   Apply migration: `supabase db push`.
3.  **API Input Validation (Zod):**
    *   Define schemas in `src/lib/schemas.ts` (or a similar location):
        ```typescript
        // src/lib/schemas.ts
        import { z } from 'zod';

        export const CaptionRuleCreateSchema = z.object({
          name: z.string().trim().min(1, { message: "Name cannot be empty" }),
          rules_text: z.string().trim().min(1, { message: "Rules text cannot be empty" }),
        });

        export const CaptionRuleUpdateSchema = z.object({
          name: z.string().trim().min(1, { message: "Name cannot be empty" }).optional(),
          rules_text: z.string().trim().min(1, { message: "Rules text cannot be empty" }).optional(),
        }).refine(data => data.name || data.rules_text, {
          message: "At least one field (name or rules_text) must be provided for update",
        });
        ```
4.  **Rule Sets API (`src/app/api/caption-rules/route.ts`):**
    *   Use Route Handler client, check auth (`userId`), standard responses.
    *   **`GET`:**
        *   Fetch `caption_generation_rules` where `user_id` matches.
        *   `const { data, error } = await supabase.from('caption_generation_rules').select('*').eq('user_id', userId);`
        *   Return `{ data }` or `{ error }`.
    *   **`POST`:**
        *   Validate body with `CaptionRuleCreateSchema`.
        *   `const { data, error } = await supabase.from('caption_generation_rules').insert({ ...validatedData, user_id: userId }).select().single();`
        *   Return `{ data }` or `{ error }`.
5.  **Rule Set Detail API (`src/app/api/caption-rules/[id]/route.ts`):**
    *   Use Route Handler client, check auth (`userId`), validate `params.id`.
    *   **`PUT`:**
        *   Validate body with `CaptionRuleUpdateSchema`.
        *   `const { data, error } = await supabase.from('caption_generation_rules').update(validatedData).eq('id', params.id).eq('user_id', userId).select().single();`
        *   Check if `data` exists (if row was actually updated).
        *   Return `{ data }` or `{ error }`.
    *   **`DELETE`:**
        *   `const { error } = await supabase.from('caption_generation_rules').delete().eq('id', params.id).eq('user_id', userId);`
        *   Return `{ data: { success: true } }` or `{ error }`.

**Completion Checks:**

*   [X] Migration created & applied (manually by user).
*   [X] `caption_generation_rules` table exists with correct columns, constraints, RLS, index, trigger.
*   [X] Zod schemas defined.
*   [X] `/api/caption-rules` GET/POST implemented with auth, validation, standard responses.
*   [X] `/api/caption-rules/[id]` PUT/DELETE implemented with auth, validation, standard responses.

---

## Chunk 2: Frontend Rule Management UI (`CaptionRuleManager.tsx`)

**Goal:** Create the modal component for viewing default rules and managing custom rule sets.

**Detailed Steps & Pseudocode:**

1.  **Helper for Default Rules:**
    *   Export a helper function from `src/lib/utils/prompts.ts`:
        ```typescript
        // src/lib/utils/prompts.ts
        export const getDefaultCaptionRules = (): string => {
          return `- Keep it SHORT
- No explaining the joke
// ... (rest of the default rules) ...
- Never quote or reference the template's original language directly in your caption.`;
        };

        // Modify getCaptionGenerationTestPrompt as planned later
        ```
2.  **Create `CaptionRuleManager.tsx` Component:**
    *   `'use client';` Component accepts `isOpen`, `onClose` props. Use a modal library.
    *   Import `getDefaultCaptionRules` from `prompts.ts`.
    *   Import SWR, fetcher, toast. Define `CaptionRule` interface (matching DB schema).
    *   **State:**
        *   `const [mode, setMode] = useState<'list' | 'view_default' | 'edit' | 'add'>('list');`
        *   `const [selectedRuleSet, setSelectedRuleSet] = useState<CaptionRule | null>(null);`
        *   `const [nameInput, setNameInput] = useState('');`
        *   `const [rulesInput, setRulesInput] = useState('');`
        *   `const [isSubmitting, setIsSubmitting] = useState(false);`
    *   **Data Fetching:**
        *   `const { data: ruleSets, error, isLoading, mutate } = useSWR<CaptionRule[]>('/api/caption-rules', fetcher);`
        *   `const defaultRulesText = getDefaultCaptionRules();`
    *   **UI Logic (Conditional Rendering based on `mode`):**
        *   **`mode === 'list'`:**
            *   Display loading/error states for SWR fetch.
            *   Render a non-interactive item "Default Rules" with a "View" button (`onClick={() => setMode('view_default')}`).
            *   Map `ruleSets` to list items, each showing `rule.name` with "Edit" (`onClick={() => { setSelectedRuleSet(rule); setMode('edit'); /* ... set form inputs ... */ }}`) and "Delete" buttons (`onClick={() => handleDelete(rule.id)}`).
            *   "Add New Rule Set" button (`onClick={() => { setSelectedRuleSet(null); setMode('add'); /* ... clear/set form inputs ... */ }}`).
        *   **`mode === 'view_default'`:**
            *   Display "Default Rules" title.
            *   Show `defaultRulesText` in a read-only textarea or `<pre>` block.
            *   "Back" button (`onClick={() => setMode('list')}`).
        *   **`mode === 'add'` or `mode === 'edit'`:**
            *   Display appropriate title ("Add New" or "Edit Rule Set").
            *   Form with:
                *   Input for `name` (controlled by `nameInput`).
                *   Textarea for `rules_text` (controlled by `rulesInput`). Show placeholder/helper text about rules. For 'add' mode, consider setting `rulesInput` initial state to `defaultRulesText`.
                *   "Save" button (disabled if `isSubmitting`), calls `handleSave`.
                *   "Cancel" button (`onClick={() => setMode('list')}`).
    *   **Helper Functions:**
        *   `handleSave()`:
            *   `setIsSubmitting(true);`
            *   Determine URL (`/api/caption-rules` or `/api/caption-rules/[id]`) and METHOD (`POST` or `PUT`).
            *   Prepare body data (`{ name: nameInput, rules_text: rulesInput }`). For PUT, only include changed fields if desired.
            *   Call `fetch`. Handle success (show toast, call `mutate()`, set `mode('list')`) or error (show toast).
            *   `setIsSubmitting(false);`
        *   `handleDelete(id)`:
            *   Show confirmation dialog.
            *   Call `fetch` to `DELETE /api/caption-rules/[id]`.
            *   Handle success (show toast, call `mutate()`) or error (show toast).
    *   **Initial State Setup:** When switching modes (e.g., 'edit', 'add'), set `nameInput` and `rulesInput` appropriately.

**Notes:**
*   Modal styling (width, height, layout) and button styles (size, color) were adjusted to match `PersonaManager.tsx` for visual consistency.
*   The `PersonaManager.tsx` component was also refactored to use the same inline list/add/edit mode pattern as `CaptionRuleManager.tsx`.
*   Textareas in both modals were made taller (`h-48`) and vertically resizable.

**Completion Checks:**

*   [X] `getDefaultCaptionRules` helper created and exported.
*   [X] `CaptionRuleManager.tsx` created as a client component modal.
*   [X] Default rules imported and viewable in read-only mode.
*   [X] SWR fetches custom rules correctly (conditionally when modal is open).
*   [X] List view displays default (with view) and custom rules (with edit/delete).
*   [X] Add/Edit form works, populates correctly, uses controlled inputs.
*   [X] Save/Delete functions call correct APIs, handle responses, update SWR cache, show toasts.
*   [X] Loading/submitting/error states handled.
*   [X] Visual styling aligned with `PersonaManager.tsx`.
*   [X] `PersonaManager.tsx` refactored for consistent editing flow.

---

## Chunk 3: Frontend Selection Integration (`MemeSelectorV2.tsx`)

**Goal:** Allow users to select a rule set (default or custom) to apply during caption generation.

**Detailed Steps & Pseudocode:**

1.  **Import and Fetch:**
    *   Import `CaptionRuleManager` and SWR/fetcher.
    *   Add SWR hook: `const { data: captionRuleSets, isLoading: isLoadingRuleSets } = useSWR<CaptionRule[]>('/api/caption-rules', fetcher);`
2.  **State Management:**
    *   Add state for selection: `const [selectedRuleSetId, setSelectedRuleSetId] = useState<string>(''); // Empty string for default`
    *   Add state for modal: `const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);`
3.  **UI Modifications (within the initial form):**
    *   Add a new section below Persona selection:
        ```tsx
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Caption Rules Style
          </label>
          <div className="flex items-center gap-2">
            <select
              value={selectedRuleSetId}
              onChange={(e) => setSelectedRuleSetId(e.target.value)}
              disabled={isLoadingRuleSets}
              className="flex-grow p-2 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">Default Rules</option>
              {captionRuleSets?.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsRuleModalOpen(true)}
              className="flex-shrink-0 py-2 px-3 bg-gray-600 hover:bg-gray-500 text-white rounded-md text-sm"
              title="Manage Caption Rules"
            >
              Manage
            </button>
          </div>
          {/* Optional: Add loading/error indicator for rule sets fetch */}
        </div>
        ```
4.  **Render Modal:**
    *   Include the modal component in the return statement:
        `<CaptionRuleManager isOpen={isRuleModalOpen} onClose={() => setIsRuleModalOpen(false)} />`

**Notes:**
*   The initial form layout was updated (wrapper removed, padding/margins adjusted) to resemble the `AIMemeSelector.tsx` component.
*   `localStorage` was implemented to persist the `selectedPersonaId` and `selectedRuleSetId` across page loads.
*   The `handleStartOver` function now clears these `localStorage` values.

**Completion Checks:**

*   [X] SWR hook added to fetch caption rules.
*   [X] State variables for selection and modal visibility added.
*   [X] Dropdown UI added, populating "Default" and custom rule names.
*   [X] Dropdown reflects `selectedRuleSetId` state.
*   [X] "Manage" button added and triggers the modal.
*   [X] `CaptionRuleManager` modal is rendered correctly.
*   [X] Form layout updated for visual consistency.
*   [X] `localStorage` persistence added for selections.

---

## Chunk 4: Dynamic Prompt Construction

**Goal:** Modify the prompt generation utility and its usage to incorporate the selected rules.

**Detailed Steps & Pseudocode:**

1.  **Modify `src/lib/utils/prompts.ts`:**
    *   (Ensure `getDefaultCaptionRules` helper from Chunk 2 exists).
    *   Update `getCaptionGenerationTestPrompt`:
        ```typescript
        export const getCaptionGenerationTestPrompt = (
          audience: string,
          rulesText?: string | null // Optional custom rules
        ): string => {
          const defaultRules = getDefaultCaptionRules(); // Use the helper
          const finalRules = rulesText?.trim() ? rulesText.trim() : defaultRules;

          // Construct the prompt string using template literals
          // and inject `finalRules` into the "Key rules for captions:" section.
          return \`You are an expert meme caption generator...
        ...
        Key rules for captions:
        \${finalRules}
        ...
        OUTPUT FORMATTING INSTRUCTIONS:
        ...\`;
        };
        ```
2.  **Modify `MemeSelectorV2.tsx` (`generateCaptionsForAllTemplates`):**
    *   Locate the part where the system prompt is generated before the loop.
    *   Use the `selectedRuleSetId` and fetched `captionRuleSets` to get the custom rules text.
        ```typescript
        // Inside generateCaptionsForAllTemplates
        const selectedPersona = personas?.find(p => p.id === selectedPersonaId);
        const audienceContext = selectedPersona ? selectedPersona.name : "general audience";

        // Find the selected custom rule set's text
        const selectedRuleSet = captionRuleSets?.find(rule => rule.id === selectedRuleSetId);
        const customRulesText = selectedRuleSet?.rules_text; // Will be undefined if default is selected (selectedRuleSetId is '')

        // Generate the system prompt using the modified function
        const systemPromptText = getCaptionGenerationTestPrompt(audienceContext, customRulesText);

        // --- Existing loop starts here ---
        for (const template of templates) {
          for (const modelId of models) {
            // const systemPrompt = ... // REMOVE or replace this line
            const userMessage = \`...\`; // Keep user message logic

            const apiRequestBody = {
              model: modelId,
              messages: [
                { role: 'system', content: systemPromptText }, // Use the dynamically generated prompt
                { role: 'user', content: userMessage }
              ],
              temperature: 0.7
            };

            // ... fetch call using apiRequestBody ...
          }
        }
        // ... rest of the function ...
        ```

**Completion Checks:**

*   [X] `getCaptionGenerationTestPrompt` accepts optional `rulesText`.
*   [X] `getCaptionGenerationTestPrompt` correctly uses custom or default rules to build the prompt string.
*   [X] `generateCaptionsForAllTemplates` in `MemeSelectorV2.tsx` correctly identifies the selected rule set ID.
*   [X] It retrieves the `rules_text` for custom rules.
*   [X] It calls the modified `getCaptionGenerationTestPrompt` with the appropriate audience and rules text (or null/undefined).
*   [X] The resulting `systemPromptText` is correctly used in the `messages` array sent to the `/api/ai/chat` endpoint.
*   [X] End-to-end test: Verify selecting "Default Rules" uses the original rules, and selecting a custom rule set uses the user-provided rules in the generated captions.

--- 