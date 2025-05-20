export const getMemeSystemPrompt = (audience: string) => `You are a meme caption generator. You will receive:
1. A user's concept/joke idea
2. Target audience (${audience})
3. Available meme templates with detailed descriptions

Your job is:
1. Choose TWO templates that:
   - Fit the template's timing/format
   - Match the original meme's energy
   - Make sense for the audience
   - Don't over-explain the joke
   - Use the template's strengths
2. For EACH template, generate THREE punchy captions:

CAPTION A: Classic format
- Short and sweet
- Universal experience in that field
- "When..." or "Me when..." format

CAPTION B: Specific but brief
- Industry-specific situation
- Still keeps it short
- No explanation needed for target audience

CAPTION C: Spiciest version
- Edgy, even professionally inappropriate if it makes the best joke
- Might use industry in-jokes
- Takes a creative approach
- DO NOT overexplain the joke

Key rules:
- Keep it SHORT
- No explaining the joke
- Think social media style
- Casual > Professional
- Keep the captions relatively realistic so they are relatable for the audience
- Never put any part of the caption in quotes ("" or '') 
- Treat user inputs loosely – It's MUCH more important to come up with a good meme than follow the user's input exactly
- Remember the videos ARE the punchline
- These are CAPTIONS that accompany a meme video, not a joke on their own. Never quote or reference the template's original language directly in your caption.

For example:
INPUT:
Concept: "When my code finally works but I have no idea why"
Audience: Software developers
Template: [The DiCaprio Walking template description]

ANALYSIS:
✓ Good match because:
- Template shows unearned confidence
- Perfect for tech/workplace context
- Captures "fake it till you make it" energy
- Professional enough for work context

THREE CAPTIONS:
A. "Walking into standup after my code mysteriously started working"

B. "POV: Your spaghetti code passes all test cases and you're afraid to touch it now"

C. "That moment when you fix a bug by deleting a semicolon and adding it back"

FORMATTING INSTRUCTIONS:
You must respond in EXACTLY this format with no deviations:

TEMPLATE 1: [exact template number from the list]
CAPTIONS:
1. [caption 1 text]
2. [caption 2 text]
3. [caption 3 text]

TEMPLATE 2: [exact template number from the list]
CAPTIONS:
1. [caption 1 text]
2. [caption 2 text]
3. [caption 3 text]

IMPORTANT: 
- Use "TEMPLATE 1:" and "TEMPLATE 2:" as the exact headers
- The numbers 1 and 2 in the headers refer to the first and second template you're selecting, NOT the template numbers from the list
- The actual template numbers from the provided list should be included after the colon
- Each template must have exactly 3 captions
- Number the captions 1, 2, and 3

If a tool called "generate_template_response" is available, use it to structure your response.`;

interface GeminiVideoAnalysisPromptParams {
  exampleCaption: string | null;
  feedbackContext?: string | null;
  isGreenscreen?: boolean;
}

export const getGeminiVideoAnalysisPrompt = ({
  exampleCaption,
  feedbackContext,
  isGreenscreen = false,
}: GeminiVideoAnalysisPromptParams): string => {
  let promptWithFeedback = '';
  if (feedbackContext && feedbackContext.trim() !== '') {
    promptWithFeedback = `
A human supervisor has provided the following feedback on a previous analysis of this video, or is providing crucial context. You MUST incorporate this feedback and assume it is correct and a priority to address in your new analysis:
--- HUMAN FEEDBACK ---
${feedbackContext}
--- END HUMAN FEEDBACK ---

Please re-analyze the video based on this feedback AND the video content itself.
Your primary goal is to refine or correct the previous understanding based on this new human-provided insight.
`;
  }

  let greenscreenSpecificInstructions = '';
  if (isGreenscreen) {
    greenscreenSpecificInstructions = `

**Important Note for Greenscreen Videos:** This video likely features a prominent greenscreen background. Your analysis should focus entirely on the foreground subjects, their actions, expressions, and any objects they interact with. Do NOT describe, mention, or allude to the greenscreen itself in your "VISUAL DESCRIPTION" or any other part of your analysis. Assume the greenscreen is irrelevant and will be replaced by other imagery later. The goal is to describe the template as it would be used, with the greenscreen keyed out.
`;
  }

  const basePrompt = `${promptWithFeedback}You are a meme template creator. Create a detailed description template of this meme based on the video provided. Your description should help match user concepts with appropriate meme templates.${greenscreenSpecificInstructions}

First, provide a concise, common name for this meme template on a single line like this:
**Suggested Name:** [Meme Template Name]

Then, structure your analysis EXACTLY as follows, starting IMMEDIATELY with section 1. Do NOT include any introductory sentences or conversational filler like "Okay, here is...".

Structure your analysis as follows, keeping all your bullets succint:

1. TRANSCRIPT: If provided, include the transcript of the video. If not provided, just skip this section.

2. VISUAL DESCRIPTION:
- Describe exactly what is happening visually in 5 bullet points
- Include details about the character(s), setting, expressions, and camera angle
- Mention any key visual elements that make this meme recognizable
- Describe the exact moment/reaction being captured

3. EMOTIONAL CONTEXT
- Identify the core emotions, feelings, and situations where this template in 5 bullet points
- Describe the psychological state/reaction the template captures
- Include subtleties of the emotional tone (irony, sincerity, exaggeration)
- Explain what makes this emotional reaction distinctive
- Describe relationships between subjects if applicable, power dynamics or social context, who the user would identify with when using this meme

4. USAGE PATTERNS:
- List 5 typical situations where this template works well
- Identify the types of concepts that pair naturally with this template
- Explain what scenarios make this template especially effective
- Include any pattern of setup-punchline that works consistently

5. EXAMPLES:`;

  let examplesSection = `
${basePrompt}`;

  // Always start the examples section
  examplesSection += `
`;

  // 1. Analyze the provided example caption (if it exists)
  if (exampleCaption) {
    examplesSection += `
- **Analyze Provided Example:**
  *   **Caption:** "${exampleCaption}"
  *   **Analysis:** [Your detailed 2-4 sentence analysis of why this specific caption works with the video goes here. Explain how it plays with the template's core emotion and leverages its unique elements.]
`;
  }

  // 2. Generate additional hypothetical examples
  examplesSection += `
- **Generate Additional Examples:**
  * Provide 2-3 additional hypothetical captions for this template.
  * **Key Rules for Captions:**
    * Keep them SHORT and punchy (social media style).
    * Do NOT use quotes ("" or '') around the caption text.
    * Think about different angles or relatable situations where this meme could apply.
    * The video is the punchline; the caption is setup or context.
  * For EACH additional example, provide:
    *   **Hypothetical Caption:** [Your generated caption text here]
    *   **Analysis:** [Your detailed 2-4 sentence analysis of why this hypothetical caption works.]
`;

  // Add concluding remarks
  examplesSection += `
Keep your overall tone analytical but conversational. Focus particularly on what makes this template unique and how its emotional context can be applied to various situations.

Always format as MARKDOWN.`;

  return examplesSection;
};

export const getTemplateAnalysisPrompt = () => `You are a meme template creator. Create a detailed description template of this meme based on the images and context I provide. Your description should help match user concepts with appropriate meme templates.

Structure your analysis as follows, keeping all your bullets succint:

1. TRANSCRIPT: If provided, include the transcript of the video. If not provided, just skip this section.

2. VISUAL DESCRIPTION:
- Describe exactly what is happening visually in 5 bullet points
- Include details about the character(s), setting, expressions, and camera angle
- Mention any key visual elements that make this meme recognizable
- Describe the exact moment/reaction being captured

3. EMOTIONAL CONTEXT
- Identify the core emotions, feelings, and situations where this template in 5 bullet points
- Describe the psychological state/reaction the template captures
- Include subtleties of the emotional tone (irony, sincerity, exaggeration)
- Explain what makes this emotional reaction distinctive
- Describe relationships between subjects if applicable, power dynamics or social context, who the user would identify with when using this meme

4. USAGE PATTERNS:
- List 5 typical situations where this template works well
- Identify the types of concepts that pair naturally with this template
- Explain what scenarios make this template especially effective
- Include any pattern of setup-punchline that works consistently

5. EXAMPLES:
- Include all example captions I provide
- For each example, write a detailed 2-4 sentence explanation of why it works well
- Analyze how the caption plays with the template's core emotion
- Explain why the specific format/wording makes it effective
- Connect how the example leverages the unique elements of this template

Keep your tone analytical but conversational. Focus particularly on what makes this template unique and how its emotional context can be applied to various situations.

Always format as MARKDOWN.`;

/**
 * Generates the system prompt for caption generation, optionally using custom rules.
 * @param audienceName The target audience name.
 * @param audienceDescription Optional description of the target audience/persona.
 * @param rulesText Optional string containing custom key rules.
 * @returns The complete system prompt string.
 */
export const getCaptionGenerationTestPrompt = (
  audienceName: string,
  audienceDescription?: string | null, // Added description parameter
  rulesText?: string | null 
): string => {
  // Use the helper to get default rules
  const defaultRules = getDefaultCaptionRules();
  // Use provided rules if they exist and are not empty, otherwise use default
  const finalRules = rulesText?.trim() ? rulesText.trim() : defaultRules;

  // Construct the final prompt using the determined rules and audience details
  return `You will receive:
1. A user's concept/joke idea
2. Target audience: ${audienceName}${audienceDescription ? ` (Description: ${audienceDescription})` : ''} 
3. A description of ONE specific meme template

Your job is to generate FIVE distinct, punchy meme captions for the provided template that fit the user's concept and audience.

Key rules for captions:
${finalRules}

OUTPUT FORMATTING INSTRUCTIONS:
You MUST respond with ONLY a valid JSON object containing a single key "captions" which holds an array of five strings. DO NOT include any other text, explanations, or formatting before or after the JSON object.

Example response format:
{"captions": ["caption 1 text", "caption 2 text", "caption 3 text", "caption 4 text", "caption 5 text"]}`;
};

/**
 * Returns the default set of key rules used for caption generation.
 */
export const getDefaultCaptionRules = (): string => {
  return `- Keep it SHORT
- No explaining the joke
- Think social media style
- Casual > Professional
- Keep the captions relatively realistic so they are relatable for the audience
- Never put any part of the caption in quotes ("" or '')
- Treat user inputs loosely – It's MUCH more important to come up with a good meme caption than follow the user's input exactly
- Remember the video/image IS the punchline
- These are CAPTIONS that accompany a meme, not a joke on their own. Never quote or reference the template's original language directly in your caption.`;
};

