# Caption Rules Modification - Overall Plan

**Goal:** Allow users to create, save, select, view, and use custom sets of "Key Rules" for meme caption generation within the `MemeSelectorV2` component. This will replace the default, hardcoded rules when a custom set is selected. Users should also be able to view the default rules for reference without being able to edit them.

**Core Feature:** Introduce the concept of user-defined "Caption Rule Sets" that modify only the instructional rules part of the caption generation system prompt.

**Implementation Chunks:**

1.  **Data Modeling & Backend APIs:**
    *   Define a new Supabase table (`caption_generation_rules`) to store user-created rule sets (name, rules text, user ID).
    *   Implement Supabase Row Level Security (RLS) for user data isolation.
    *   Create backend API endpoints (`/api/caption-rules`) for CRUD (Create, Read, Update, Delete) operations on these rule sets, ensuring authentication and validation.

2.  **Frontend Rule Management UI:**
    *   Develop a new React component (`CaptionRuleManager.tsx`), presented as a modal.
    *   This component will:
        *   Fetch and display a list of the user's custom rule sets.
        *   Provide options to Add, Edit, and Delete custom rule sets using an inline editing pattern.
        *   Include a way to view the static, default rules (read-only).
        *   Use a data fetching library (like SWR) for managing the state of custom rules.
    *   Refactor `PersonaManager.tsx` to use the same inline editing pattern for consistency.

3.  **Frontend Selection Integration:**
    *   Modify the `MemeSelectorV2.tsx` component.
    *   Add UI elements (e.g., a dropdown select menu) to allow users to choose between "Default Rules" and their saved custom rule sets.
    *   Persist the last selected Persona ID and Rule Set ID using `localStorage`.
    *   Include a button to open the `CaptionRuleManager` modal.
    *   Fetch the available custom rule sets to populate the dropdown.
    *   Update the layout to match the `AIMemeSelector` component more closely.

4.  **Dynamic Prompt Construction:**
    *   Refactor the utility function (`getCaptionGenerationTestPrompt` in `src/lib/utils/prompts.ts`) that generates the system prompt.
    *   Modify it to accept the text of the selected custom rules as an optional parameter.
    *   If custom rules are provided, inject them into the appropriate section of the prompt template; otherwise, use the hardcoded default rules.
    *   Update the caption generation logic in `MemeSelectorV2.tsx` to:
        *   Check which rule set is selected (default or custom).
        *   Retrieve the text of the custom rules if applicable.
        *   Call the modified prompt utility function with the correct rules.
        *   Send the resulting dynamically constructed system prompt to the AI API.

**Key Outcome:** Users gain flexibility in guiding caption generation by defining and applying their preferred rule sets, while the core prompt structure and output formatting remain consistent. 