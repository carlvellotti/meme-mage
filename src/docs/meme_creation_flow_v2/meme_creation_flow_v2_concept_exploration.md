# Technical Specification: Explore Concept for Meme Caption Regeneration

**Component:** `src/app/components/MemeSelectorV2.tsx`
**Date:** May 1, 2025

## 1. Feature Overview

This feature allows users to refine meme caption generation for a specific set of results. After initial captions are generated for a meme template by different AI models and rule sets, the user can provide a specific "concept" or "theme" for any given model/rule-set combination. The system will then regenerate a new set of captions for *only that specific combination*, incorporating the user's concept while retaining all original context (persona, rules, template details, initial user prompt).

## 2. UI Changes

For each `ModelGenerationAttempt` block (i.e., for each AI model's output using a specific caption rule set for a single template), the following UI elements will be added at the bottom of its list of generated captions:

*   **Concept Input Textarea:**
    *   A `textarea` element.
    *   Placeholder: e.g., "Enter a concept to explore for these captions..."
    *   This will allow users to type their specific theme or idea.
*   **Regenerate Button:**
    *   A `<button>` element.
    *   Label: e.g., "Regenerate with Concept" or "Explore Theme".
    *   This button will be associated with the specific `ModelGenerationAttempt` block it's under.

**Visual Placement:**

```
[Template Image/Video]
  [Model X - Rule Set Y Captions]
    [Caption 1 Button]
    [Caption 2 Button]
    ...
    [Caption 5 Button]
    <textarea placeholder="Enter a concept to explore..."></textarea>
    <button>Regenerate with Concept</button>
  [Model X - Rule Set Z Captions]
    ... (similar structure)
  ...
```

## 3. State Management

### New State Variables:

1.  `conceptInputs`:
    *   Type: `Record<string, string>`
    *   Description: Stores the text entered by the user in each "concept input textarea".
    *   Key: A unique identifier for each `ModelGenerationAttempt` block, e.g., `${template.id}_${modelId}_${ruleSetId}`.
    *   Example: `{ "template1_anthropic-3.5_default": "focus on irony", "template1_anthropic-3.5_customRule123": "make it about cats" }`

2.  `conceptRegenerationLoading`:
    *   Type: `Record<string, boolean>`
    *   Description: Tracks the loading state for individual concept regeneration attempts.
    *   Key: Same unique identifier as `conceptInputs`.
    *   Example: `{ "template1_anthropic-3.5_default": true }`

### Existing State Used:

*   `memeOptions: MemeOption[] | null`: The main state holding all generated templates and their caption attempts. This will be updated in place.
*   `selectedPersonaId: string`: To get persona details.
*   `personas: Persona[]`: To get selected persona's name/description.
*   `captionRuleSets: CaptionRule[]`: To get the `rules_text` for the specific rule set being regenerated.
*   `userPrompt: string`: The initial global user prompt for the meme idea.

## 4. Data Flow & Logic for Regeneration

### 4.1. `handleRegenerateWithConcept` Function (New Handler)

This function will be triggered when a "Regenerate with Concept" button is clicked.

**Parameters:**

*   `templateId: string`
*   `modelId: string`
*   `ruleSetId: string` (This is the `id` of the `CaptionRule` or `''` for default rules)
*   `ruleSetName: string` (Display name of the rule set, e.g., "Default Rules" or custom name)

**Logic (Pseudocode):**

```typescript
async function handleRegenerateWithConcept(templateId, modelId, ruleSetId, ruleSetName) {
  // 1. Generate unique key for state management
  const blockKey = `${templateId}_${modelId}_${ruleSetId}`;

  // 2. Get the user-provided concept from state
  const userConcept = conceptInputs[blockKey];
  if (!userConcept || userConcept.trim() === "") {
    toast.error("Please enter a concept to explore.");
    return;
  }

  // 3. Set loading state
  setConceptRegenerationLoading(prev => ({ ...prev, [blockKey]: true }));
  toast.loading("Regenerating captions with your concept...");

  // 4. Gather all necessary context
  //    a. Find the MemeTemplate object
  const currentMemeOption = memeOptions.find(opt => opt.template.id === templateId);
  const template = currentMemeOption?.template;
  if (!template) {
    // Handle error: template not found
    toast.error("Error: Original template data not found.");
    setConceptRegenerationLoading(prev => ({ ...prev, [blockKey]: false }));
    return;
  }

  //    b. Get Persona details
  const selectedPersona = personas?.find(p => p.id === selectedPersonaId);
  const audienceName = selectedPersona ? selectedPersona.name : "general audience";
  const audienceDescription = selectedPersona ? selectedPersona.description : null;

  //    c. Get Caption Rules text
  let actualRulesText;
  if (ruleSetId === "") { // Default rules
    // actualRulesText = getDefaultCaptionRules(); // Assuming getDefaultCaptionRules() is accessible
    // OR, if default rules text isn't stored separately and relies on `primaryRulesText` being undefined in getCaptionGenerationTestPrompt
    actualRulesText = undefined; 
  } else {
    const ruleSet = captionRuleSets?.find(rule => rule.id === ruleSetId);
    actualRulesText = ruleSet?.rules_text;
  }
  // If ruleSetId was valid but rules_text not found, it might be an issue, 
  // but getCaptionGenerationTestPrompt handles undefined rulesText by falling back to default.

  //    d. Original global user prompt
  const originalGlobalUserPrompt = userPrompt; // From component state

  // 5. Construct AI Prompts
  //    a. System Prompt (re-using existing utility)
  const systemPrompt = getCaptionGenerationTestPrompt(audienceName, audienceDescription, actualRulesText);

  //    b. User Message (New construction for this feature)
  let userMessage = `Original User Idea (if any): "${originalGlobalUserPrompt || "Create general captions for this meme template."}"

`;
  userMessage += `Template Name: ${template.name}
`;
  userMessage += `Template Instructions: ${template.instructions || 'None'}

`;
  userMessage += `Now, please generate a new set of 5 captions.
`;
  userMessage += `For these new captions, I want you to specifically explore this theme/concept: "${userConcept}"

`;
  userMessage += `Ensure these new captions are still appropriate for the ${audienceName} and strictly follow the captioning rules previously established (which are part of your system instructions).`;

  // 6. Make API Call
  try {
    const apiRequestBody = {
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7 // Or reuse original temperature if tracked
    };

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiRequestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const result = await response.json();
    let newCaptions = [];
    // Parse result.response (which is expected to be a JSON string array of captions)
    // (Similar parsing logic as in generateCaptionsForAllTemplates)
    // Example:
    // const responseText = result.response;
    // let jsonString = responseText;
    // if (jsonString.includes('```')) { ... } // Strip markdown
    // const parsedContent = JSON.parse(jsonString);
    // if (parsedContent.captions && Array.isArray(parsedContent.captions)) { newCaptions = parsedContent.captions; }
    // else if (Array.isArray(parsedContent)) { newCaptions = parsedContent; }
    // else { throw new Error("Unexpected response format from AI"); }
    // newCaptions = newCaptions.slice(0, 5); // Ensure max 5 captions

    // --- Parsing logic placeholder ---
    const parsedCaptions = JSON.parse(result.response); // Simplified for pseudocode
    newCaptions = (Array.isArray(parsedCaptions.captions) ? parsedCaptions.captions : Array.isArray(parsedCaptions) ? parsedCaptions : []).slice(0,5);


    // 7. Update State: Replace captions for the specific ModelGenerationAttempt
    setMemeOptions(prevMemeOptions => {
      if (!prevMemeOptions) return null;
      return prevMemeOptions.map(opt => {
        if (opt.template.id === templateId) {
          return {
            ...opt,
            modelCaptions: opt.modelCaptions.map(mc => {
              if (mc.modelId === modelId) {
                return {
                  ...mc,
                  generationAttempts: mc.generationAttempts.map(attempt => {
                    if (attempt.ruleSetId === ruleSetId) { // Found the specific block
                      return {
                        ...attempt,
                        captions: newCaptions,
                        error: undefined, // Clear previous error if any
                        // latency: newLatency // Optionally update latency
                      };
                    }
                    return attempt;
                  })
                };
              }
              return mc;
            })
          };
        }
        return opt;
      });
    });

    toast.success("Captions regenerated with your concept!");

  } catch (error) {
    console.error("Error regenerating captions with concept:", error);
    toast.error(error.message || "Failed to regenerate captions.");
    // Optionally, update the specific attempt with an error message
     setMemeOptions(prevMemeOptions => {
      if (!prevMemeOptions) return null;
      return prevMemeOptions.map(opt => {
        if (opt.template.id === templateId) {
          return {
            ...opt,
            modelCaptions: opt.modelCaptions.map(mc => {
              if (mc.modelId === modelId) {
                return {
                  ...mc,
                  generationAttempts: mc.generationAttempts.map(attempt => {
                    if (attempt.ruleSetId === ruleSetId) {
                      return { ...attempt, error: error.message || "Regeneration failed" };
                    }
                    return attempt;
                  })
                };
              }
              return mc;
            })
          };
        }
        return opt;
      });
    });
  } finally {
    setConceptRegenerationLoading(prev => ({ ...prev, [blockKey]: false }));
    // Clear the input field for that block after attempt
    // setConceptInputs(prev => ({ ...prev, [blockKey]: "" })); // Optional: clear input
  }
}
```

### 4.2. Rendering Logic Changes

Inside the `memeOptions.map(...)` loop, and then inside `option.modelCaptions.map(...)`, and further inside `modelCaption.generationAttempts.map(...)`:

After rendering the list of `attempt.captions` buttons, add:

```jsx
// Pseudocode for rendering new UI elements within the generationAttempts.map loop

const blockKey = `${option.template.id}_${modelCaption.modelId}_${attempt.ruleSetId}`;

// Textarea for concept input
<textarea
  value={conceptInputs[blockKey] || ""}
  onChange={(e) => {
    const newText = e.target.value;
    setConceptInputs(prev => ({ ...prev, [blockKey]: newText }));
  }}
  placeholder="Enter a concept to explore for these captions..."
  className="..." // Add appropriate styling
  disabled={conceptRegenerationLoading[blockKey]}
/>

// Regenerate button
<button
  onClick={() => handleRegenerateWithConcept(option.template.id, modelCaption.modelId, attempt.ruleSetId, attempt.ruleSetName)}
  disabled={conceptRegenerationLoading[blockKey] || !(conceptInputs[blockKey] || "").trim()}
  className="..." // Add appropriate styling
>
  {conceptRegenerationLoading[blockKey] ? "Regenerating..." : "Regenerate with Concept"}
</button>

// Display error specific to this regeneration attempt if any
// This error would be part of the `attempt` object if we decide to store it there upon failure.
// For example: if (attempt.regenerationError) { <p className="text-red-500">{attempt.regenerationError}</p> }
```

## 5. Key Considerations

*   **Error Handling:** Each individual regeneration attempt should clearly indicate success, failure, or loading state without affecting other caption blocks.
*   **State Updates:** Ensure that `setMemeOptions` correctly updates the nested structure immutably.
*   **Unique Keys:** The construction of `blockKey` must be consistent and unique for each textarea/button group.
*   **Default Rules Handling:** Ensure `ruleSetId = ''` correctly maps to the default caption rules logic when reconstructing `actualRulesText`. The `getCaptionGenerationTestPrompt` function already handles `undefined` `rulesText` by using its internal default.
*   **UX:** Consider clearing the concept input field after a successful regeneration, or keeping the text. Provide clear visual feedback for loading and success/error states.

This specification outlines the core changes needed. Implementation will require careful handling of React state and asynchronous operations. 