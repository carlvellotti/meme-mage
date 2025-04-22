import 'dotenv/config'; // Load .env variables
import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateEmbedding } from '@/lib/utils/embeddings';
import { getGeminiVideoAnalysisPrompt } from '@/lib/utils/prompts';
import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
    GenerateContentRequest,
    // FileDataPart, // Not used directly here
    // InlineDataPart // Not used directly here
} from "@google/generative-ai";
import { Buffer } from 'buffer'; // Node.js Buffer

// --- Configuration --- 
const MODEL_NAME = "gemini-2.5-pro-preview-03-25";
const API_KEY = process.env.GOOGLE_API_KEY || "";
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];
const SCRIPT_DELAY_MS = 200; // Optional delay between processing each template (ms)

// --- Helper: Simple Delay --- 
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Main Re-analysis Function --- 
async function reanalyzeAllUnreviewed() {
  console.log("--- Starting Re-analysis Script for Unreviewed Templates ---");

  if (!API_KEY) {
    console.error('Error: GOOGLE_API_KEY environment variable not set.');
    return;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('Error: Supabase environment variables (URL, Service Role Key) not set.');
      return;
  }

  // Initialize Supabase Admin Client (already done via import)

  // Initialize Google AI Client
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings,
      generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8000, 
      }
  });

  // Fetch unreviewed templates
  console.log("Fetching unreviewed templates from Supabase...");
  const { data: templates, error: fetchError } = await supabaseAdmin
    .from('meme_templates')
    .select('id, video_url, instructions') // Select only needed fields
    .neq('reviewed', true);

  if (fetchError) {
    console.error("Error fetching templates:", fetchError);
    return;
  }

  if (!templates || templates.length === 0) {
    console.log("No unreviewed templates found to process.");
    return;
  }

  console.log(`Found ${templates.length} unreviewed templates.`);

  let successCount = 0;
  let failureCount = 0;

  // Loop through templates
  for (const template of templates) {
    console.log(`\nProcessing template ID: ${template.id}...`);
    const videoUrl = template.video_url;
    const exampleCaption = template.instructions; // Assumes instructions contain examples

    try {
      // --- Step 1: Fetch and Prepare Video --- 
      if (!videoUrl) {
        throw new Error('Missing video_url for template.');
      }
      console.log(`  Fetching video from: ${videoUrl}`);
      const videoResponse = await fetch(videoUrl); // Use global fetch
      if (!videoResponse.ok) {
          throw new Error(`Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`);
      }
      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
      const base64VideoData = videoBuffer.toString('base64');
      console.log(`  Video fetched & encoded (size: ${videoBuffer.length} bytes)`);

      // Determine MIME Type (simplified)
      let determinedMimeType: string | undefined = 'video/mp4';
      try {
          const url = new URL(videoUrl);
          const pathname = url.pathname;
          const extension = pathname.split('.').pop()?.toLowerCase();
          if (extension === 'webm') determinedMimeType = 'video/webm';
          // Add other types if necessary
      } catch (e) { /* Ignore */ }
      const finalMimeType: string = determinedMimeType ?? 'video/mp4';
      console.log(`  Using MIME type: ${finalMimeType}`);

      // --- Step 2: Call Gemini for Analysis --- 
      const promptText = getGeminiVideoAnalysisPrompt(exampleCaption);
      const parts: ({ text: string } | { inlineData: { mimeType: string; data: string; } })[] = [
          { text: promptText },
          { inlineData: { mimeType: finalMimeType, data: base64VideoData } }
      ];
      const requestPayload: GenerateContentRequest = { contents: [{ role: "user", parts }] };

      console.log(`  Calling Gemini (${MODEL_NAME})...`);
      const result = await model.generateContent(requestPayload);

      if (!result.response) {
          throw new Error('Gemini API did not return a valid response object.');
      }
      const blockReason = result.response?.promptFeedback?.blockReason;
      if (blockReason) {
          throw new Error(`Content generation blocked: ${blockReason}.`);
      }
      const analysisText = result.response.text();
      if (!analysisText || analysisText.trim().length === 0) {
          throw new Error('Received empty analysis text from Gemini.');
      }
      console.log(`  Gemini analysis received (length: ${analysisText.length})`);

      // Parse Name and Instructions
      let suggestedName: string | null = null;
      let newInstructions: string = analysisText ?? '';
      const lines = analysisText.split('\n');
      const nameLineIndex = lines.findIndex(line => line.startsWith('**Suggested Name:**'));
      if (nameLineIndex !== -1) {
          suggestedName = lines[nameLineIndex].replace('**Suggested Name:**', '').trim();
          newInstructions = lines.slice(nameLineIndex + 1).join('\n').trim();
      } else {
          console.warn('  Warning: Could not find "**Suggested Name:**" marker.');
      }

      if (!suggestedName) {
          throw new Error('Failed to parse suggested name from Gemini response.');
      }
      console.log(`  Suggested Name: ${suggestedName}`);

      // --- Step 3: Generate Embedding --- 
      console.log(`  Generating embedding for new instructions...`);
      const embeddingVector = await generateEmbedding(newInstructions);
      console.log(`  Embedding generated (vector length: ${embeddingVector?.length})`);

      // --- Step 4: Update Supabase --- 
      const updateData = {
        name: suggestedName,
        instructions: newInstructions,
        embedding: embeddingVector
      };
      console.log(`  Updating Supabase with new name, instructions, and embedding...`);
      const { error: updateError } = await supabaseAdmin
        .from('meme_templates')
        .update(updateData)
        .eq('id', template.id);

      if (updateError) {
        throw updateError; // Throw Supabase error
      }

      console.log(`  ✅ Successfully re-analyzed and updated template ID: ${template.id}`);
      successCount++;

    } catch (error: any) {
      console.error(`  ❌ Failed to process template ID: ${template.id}. Error: ${error.message}`);
      failureCount++;
    }

    // Optional delay
    if (SCRIPT_DELAY_MS > 0) {
        await delay(SCRIPT_DELAY_MS);
    }
  }

  console.log("\n--- Re-analysis Script Finished ---");
  console.log(`Total Templates Processed: ${templates.length}`);
  console.log(`✅ Successes: ${successCount}`);
  console.log(`❌ Failures: ${failureCount}`);
}

// --- Run the script --- 
reanalyzeAllUnreviewed().catch(err => {
  console.error("\n--- Unhandled Error Running Script ---");
  console.error(err);
  process.exit(1);
}); 