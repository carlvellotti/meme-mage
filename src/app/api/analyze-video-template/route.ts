import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerateContentRequest, FileDataPart, InlineDataPart } from "@google/generative-ai";
import { NextRequest, NextResponse } from 'next/server';
import { getGeminiVideoAnalysisPrompt } from '@/lib/utils/prompts';

// Final Model Used
const MODEL_NAME = "gemini-2.5-pro-preview-03-25";

const API_KEY = process.env.GOOGLE_API_KEY || "";

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

interface RequestBody {
  videoUrl: string;
  exampleCaption?: string | null;
  feedbackContext?: string | null;
  // Removed modelPreference
}

export async function POST(req: NextRequest) {
  console.log('[API /analyze-video-template] Received request (Inline Data Workflow)');

  if (!API_KEY) {
    console.error('[API /analyze-video-template] Error: GOOGLE_API_KEY not configured');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  let videoUrl: string | undefined;
  let exampleCaption: string | null = null;
  let feedbackContext: string | null = null;
  // Removed modelPreference variable

  try {
    const body: RequestBody = await req.json();
    videoUrl = body.videoUrl;
    exampleCaption = body.exampleCaption || null;
    feedbackContext = body.feedbackContext || null;
    // Removed modelPreference parsing
    console.log(`[API /analyze-video-template] Parsed body: videoUrl=${videoUrl}, exampleCaption=${exampleCaption}, feedbackContext=${feedbackContext}`);

    if (!videoUrl) {
      console.error('[API /analyze-video-template] Error: Missing videoUrl in request body');
      return NextResponse.json({ error: 'Missing videoUrl in request body' }, { status: 400 });
    }
    try {
       new URL(videoUrl);
    } catch (_) {
       console.error(`[API /analyze-video-template] Error: Invalid videoUrl format: ${videoUrl}`);
       return NextResponse.json({ error: 'Invalid videoUrl format' }, { status: 400 });
    }

  } catch (error) {
    console.error('[API /analyze-video-template] Error parsing request body:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Removed model selection logic

  const genAI = new GoogleGenerativeAI(API_KEY);

  try {
    console.log(`[API /analyze-video-template] Fetching video from URL for inline data: ${videoUrl}`);
    const videoResponse = await fetch(videoUrl!);
    if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video from URL: ${videoResponse.status} ${videoResponse.statusText}`);
    }
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    const base64VideoData = videoBuffer.toString('base64');
    console.log(`[API /analyze-video-template] Video fetched & base64 encoded (original size: ${videoBuffer.length} bytes)`);

    let determinedMimeType: string | undefined = 'video/mp4';
    try {
        const url = new URL(videoUrl!);
        const pathname = url.pathname;
        const extension = pathname.split('.').pop()?.toLowerCase();
        console.log(`[API /analyze-video-template] Detected extension: ${extension}`);
        if (extension === 'webm') determinedMimeType = 'video/webm';
        else if (extension === 'mov') determinedMimeType = 'video/mov';
        else if (extension === 'avi') determinedMimeType = 'video/avi';
        else if (extension === 'mpg' || extension === 'mpeg') determinedMimeType = 'video/mpeg';
        else if (extension === 'wmv') determinedMimeType = 'video/wmv';
        else if (extension === '3gp' || extension === '3gpp') determinedMimeType = 'video/3gpp';
        else if (extension === 'flv') determinedMimeType = 'video/x-flv';
    } catch (e) {
        console.warn(`[API /analyze-video-template] Could not parse URL for extension, using default: ${determinedMimeType}`);
    }
    if (!determinedMimeType) {
        determinedMimeType = 'video/mp4';
    }
    const finalMimeType: string = determinedMimeType;
    console.log(`[API /analyze-video-template] Using MIME type: ${finalMimeType}`);

    const model = genAI.getGenerativeModel({
        model: MODEL_NAME, // Use the specific PRO model name
        safetySettings,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8000, // Kept high token limit for Pro model
        }
    });

    const promptText = getGeminiVideoAnalysisPrompt(exampleCaption, feedbackContext);

    // Fixed type definition for parts to resolve linter warning
    const parts: ({ text: string } | { inlineData: { mimeType: string; data: string; } })[] = [
        { text: promptText },
        {
            inlineData: {
                mimeType: finalMimeType,
                data: base64VideoData
            }
        }
    ];

    console.log(`[API /analyze-video-template] Calling Gemini (${MODEL_NAME}) (Inline Data) for video from URL: ${videoUrl}...`);

    const requestPayload: GenerateContentRequest = {
        contents: [{ role: "user", parts }],
    };

    const result = await model.generateContent(requestPayload);

    console.log('[API /analyze-video-template] Gemini response received.');

    if (!result.response) {
        console.error('[API /analyze-video-template] Gemini response object missing. Full result:', JSON.stringify(result, null, 2));
        throw new Error('Gemini API did not return a valid response object.');
    }
    const blockReason = result.response?.promptFeedback?.blockReason;
    const safetyRatings = result.response?.promptFeedback?.safetyRatings;
    if (blockReason) {
        console.error(`[API /analyze-video-template] Content generation blocked due to: ${blockReason}`);
        if (safetyRatings) {
            console.error('Safety Ratings:', JSON.stringify(safetyRatings, null, 2));
        }
        return NextResponse.json({ error: `Content generation blocked: ${blockReason}. Please review the video content.` }, { status: 400 });
    }
    let analysisText: string | undefined;
    try {
        analysisText = result.response.text();
    } catch (textError) {
        console.error('[API /analyze-video-template] Error calling response.text():', textError);
        console.error('[API /analyze-video-template] Full Gemini response object:', JSON.stringify(result.response, null, 2));
        throw new Error('Failed to extract text from Gemini response.');
    }
    console.log(`[API /analyze-video-template] Gemini analysis received (length: ${analysisText?.length ?? 0})`);
    if (!analysisText || analysisText.trim().length === 0) {
        console.warn('[API /analyze-video-template] Received empty analysis text from Gemini.');
    }
    console.log('[API /analyze-video-template] Sending successful response.');

    // Extract Suggested Name and the rest of the analysis
    let suggestedName: string | null = null;
    let finalAnalysis: string = analysisText ?? '';

    if (analysisText) {
        const lines = analysisText.split('\n');
        const nameLineIndex = lines.findIndex(line => line.startsWith('**Suggested Name:**'));

        if (nameLineIndex !== -1) {
            suggestedName = lines[nameLineIndex].replace('**Suggested Name:**', '').trim();
            // Join the lines *after* the name line
            finalAnalysis = lines.slice(nameLineIndex + 1).join('\n').trim();
        } else {
            console.warn('[API /analyze-video-template] Could not find "**Suggested Name:**" marker in response.');
            // Keep the full text as analysis if marker is not found
            finalAnalysis = analysisText;
        }
    }

    return NextResponse.json({ analysis: finalAnalysis, suggestedName: suggestedName });

  } catch (error) {
    console.error('[API /analyze-video-template] Error during Inline Data workflow or Gemini call:', error);
    let message = 'Video analysis failed. Please try again later.';
    if (error instanceof Error) {
        if (error.message.includes('Failed to fetch video')) message = 'Could not retrieve video from source URL.';
        else if (error.message.includes('Failed to get public URL')) message = 'Could not prepare video URL for AI analysis.';
        else if (error.message.startsWith('Content generation blocked')) message = error.message;
    }

    const status = message.startsWith('Content generation blocked') ? 400 : 500;
    return NextResponse.json({ error: message }, { status: status });

  } finally {
    console.log('[API /analyze-video-template] Request finished.');
  }
} 