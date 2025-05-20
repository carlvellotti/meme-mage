import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateEmbedding } from '@/lib/utils/embeddings';

// Define the expected JSON output structure from the Python script
interface PythonScrapeResult {
  success: boolean;
  finalVideoUrl?: string;
  captionText?: string;
  instagramId?: string;
  originalUrl: string; // Python script should echo back the original URL it processed
  error?: string;
}

// Define structure for the API response for a single URL
interface SingleProcessingResult {
  originalUrl: string;
  status: 'success' | 'python_error' | 'processing_error' | 'db_error' | 'script_setup_error';
  message: string;
  templateId?: string; // If successfully inserted
  finalVideoUrl?: string;
  posterUrl?: string;
  analysis?: string;
  suggestedName?: string;
}

export async function POST(req: NextRequest) {
  let originalUrlInput: string = ''; // For logging in case of early exit

  try {
    const body = await req.json();
    const url: string = body.url; // Expect a single URL
    originalUrlInput = url;

    if (!url || typeof url !== 'string' || url.trim() === '') {
      return NextResponse.json({ error: 'Missing or invalid URL string in request body' }, { status: 400 });
    }

    console.log(`[API /api/scrape-reels] Received request to scrape URL: ${url}`);

    const scriptDir = path.resolve(process.cwd(), 'src/lib/meme-scraper');
    const scriptPath = path.join(scriptDir, 'process_reels.py');
    const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python3';

    console.log(`[API /api/scrape-reels] Script directory: ${scriptDir}`);
    console.log(`[API /api/scrape-reels] Script path: ${scriptPath}`);
    console.log(`[API /api/scrape-reels] Python executable: ${pythonExecutable}`);

    const scriptEnv = {
      ...process.env,
      SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    };

    if (!scriptEnv.SUPABASE_DB_URL) {
      console.error('[API /api/scrape-reels] Error: SUPABASE_DB_URL environment variable is not set.');
      return NextResponse.json({
        originalUrl: url,
        status: 'script_setup_error',
        message: 'Server configuration error: Missing database URL.',
      } as SingleProcessingResult, { status: 500 });
    }
    if (!scriptEnv.SUPABASE_SERVICE_KEY && !scriptEnv.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[API /api/scrape-reels] Error: SUPABASE_SERVICE_KEY/ROLE_KEY environment variable is not set.');
      return NextResponse.json({
        originalUrl: url,
        status: 'script_setup_error',
        message: 'Server configuration error: Missing Supabase service key.',
      } as SingleProcessingResult, { status: 500 });
    }

    const runPythonScriptForSingleUrl = (targetUrl: string): Promise<PythonScrapeResult | null> => {
      return new Promise((resolve, reject) => {
        console.log(`[API /api/scrape-reels] Spawning Python script for URL: ${targetUrl}`);
        // Pass the single URL to the script
        const pythonProcess = spawn(pythonExecutable, [scriptPath, targetUrl], {
          cwd: scriptDir,
          env: scriptEnv,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          output.split('\\n').forEach((line: string) => {
            if (line.trim()) console.log(`[Python STDOUT for ${targetUrl}]: ${line.trim()}`);
          });
        });

        pythonProcess.stderr.on('data', (data) => {
          const errorOutput = data.toString();
          stderr += errorOutput;
          errorOutput.split('\\n').forEach((line: string) => {
            if (line.trim()) console.error(`[Python STDERR for ${targetUrl}]: ${line.trim()}`);
          });
        });

        pythonProcess.on('close', (code) => {
          console.log(`[API /api/scrape-reels] Python script for ${targetUrl} finished with code ${code}.`);
          if (code !== 0) {
            console.error(`[API /api/scrape-reels] Python script for ${targetUrl} exited with code ${code}. Stderr: ${stderr}`);
            resolve(null);
          } else {
            // Robustly parse stdout: find the last line that is a valid JSON object.
            const lines = stdout.split('\n');
            let parsedResult: PythonScrapeResult | null = null;

            for (let i = lines.length - 1; i >= 0; i--) {
              const line = lines[i].trim();
              if (line.startsWith('{') && line.endsWith('}')) {
                try {
                  parsedResult = JSON.parse(line) as PythonScrapeResult;
                  // Assuming the first valid JSON from the end is the intended output
                  break;
                } catch (parseError) {
                  // This line looked like JSON but wasn't, or not the one we want. Continue searching.
                  console.warn(`[API /api/scrape-reels] Tried to parse line as JSON but failed for ${targetUrl}: ${line}`, parseError);
                }
              }
            }

            if (parsedResult) {
              // Ensure originalUrl from Python matches the input, or at least is present
              // If Python script includes originalUrl, prefer that. Otherwise, fill it in.
              if (!parsedResult.originalUrl) {
                parsedResult.originalUrl = targetUrl;
              }
              resolve(parsedResult);
            } else {
              console.error(`[API /api/scrape-reels] Python script for ${targetUrl} did not output a parseable JSON line in stdout. Full stdout:\n${stdout}`);
              // Also log stderr in this case, as it might contain the true error from Python if JSON wasn't printed.
              if (stderr) {
                console.error(`[API /api/scrape-reels] Python script for ${targetUrl} stderr was:\n${stderr}`);
              }
              resolve(null);
            }
          }
        });

        pythonProcess.on('error', (err) => {
          console.error(`[API /api/scrape-reels] Failed to start Python subprocess for ${targetUrl}.`, err);
          reject(err); // Reject the promise if spawning fails
        });
      });
    };

    const pythonResult = await runPythonScriptForSingleUrl(url);

    if (!pythonResult || !pythonResult.success || !pythonResult.finalVideoUrl) {
      const message = pythonResult?.error || 'Python script did not return successful data or finalVideoUrl for this URL.';
      console.error(`[API /api/scrape-reels] Python error for ${url}: ${message}`);
      return NextResponse.json({
        originalUrl: url,
        status: 'python_error',
        message,
      } as SingleProcessingResult, { status: 500 }); // Using 500 as it's a server-side script failure
    }

    // --- Start Node.js processing for successful Python scrape ---
    const { finalVideoUrl, captionText, instagramId } = pythonResult;
    let posterUrl: string | null = null;
    let analysis: string | null = null;
    let suggestedName: string | null = `Untitled Template - ${instagramId || 'UnknownID'}`;
    let embeddingVector: number[] | null = null;
    let templateId: string | undefined = undefined;

    // Keep originalUrl from the input 'url' for consistency in the result
    const currentProcessingUrl = url;

    try {
      console.log(`[Node Processing ${currentProcessingUrl}] Starting API calls...`);

      // 1. Generate Thumbnail
      try {
        const thumbResponse = await fetch(new URL('/api/generate-thumbnail', req.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrl: finalVideoUrl }),
        });
        if (thumbResponse.ok) {
          posterUrl = (await thumbResponse.json()).thumbnailUrl;
          console.log(`[Node Processing ${currentProcessingUrl}] Thumbnail success: ${posterUrl}`);
        } else {
          console.error(`[Node Processing ${currentProcessingUrl}] Thumbnail API failed: ${thumbResponse.status} ${await thumbResponse.text()}`);
        }
      } catch (e: any) {
        console.error(`[Node Processing ${currentProcessingUrl}] Thumbnail API fetch error: ${e.message}`);
      }

      // 2. Analyze Template
      try {
        const analyzeResponse = await fetch(new URL('/api/analyze-video-template', req.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrl: finalVideoUrl, exampleCaption: captionText }),
        });
        if (analyzeResponse.ok) {
          const data = await analyzeResponse.json();
          analysis = data.analysis ?? null;
          if (data.suggestedName) {
            suggestedName = data.suggestedName;
          }
          console.log(`[Node Processing ${currentProcessingUrl}] Analysis success. Name: ${suggestedName}`);
        } else {
          console.error(`[Node Processing ${currentProcessingUrl}] Analysis API failed: ${analyzeResponse.status} ${await analyzeResponse.text()}`);
          analysis = 'Analysis failed.';
        }
      } catch (e: any) {
        console.error(`[Node Processing ${currentProcessingUrl}] Analysis API fetch error: ${e.message}`);
        analysis = 'Analysis failed.';
      }

      // 3. Generate Embedding
      if (analysis && analysis !== 'Analysis failed.') {
        try {
          embeddingVector = await generateEmbedding(analysis);
          console.log(`[Node Processing ${currentProcessingUrl}] Embedding success. Length: ${embeddingVector?.length}`);
        } catch (e: any) {
          console.error(`[Node Processing ${currentProcessingUrl}] Embedding generation error: ${e.message}`);
          embeddingVector = null;
        }
      } else {
        console.warn(`[Node Processing ${currentProcessingUrl}] Skipping embedding: analysis is empty or failed.`);
      }

      // 4. Insert into Database
      console.log(`[Node Processing ${currentProcessingUrl}] Inserting into database...`);
      const insertPayload: any = {
        name: suggestedName,
        video_url: finalVideoUrl,
        poster_url: posterUrl,
        instructions: analysis,
        original_source_url: currentProcessingUrl, 
        embedding: embeddingVector,
        reviewed: false,
        uploader_name: 'Scraper',
        scraped_example_caption: captionText || null, // Use captionText directly from pythonResult
        // instagram_id: instagramId // Temporarily commented out
      };

      const { data: dbData, error: dbError } = await supabaseAdmin
        .from('meme_templates')
        .insert(insertPayload)
        .select('id')
        .single();

      if (dbError) {
        console.error(`[Node Processing ${currentProcessingUrl}] Database insertion error:`, dbError);
        return NextResponse.json({
          originalUrl: currentProcessingUrl,
          status: 'db_error',
          message: `Database insertion failed: ${dbError.message}`,
          finalVideoUrl, // Include these details for context even on DB error
          posterUrl,
          analysis,
          suggestedName,
        } as SingleProcessingResult, { status: 500 });
      }

      templateId = dbData?.id;
      console.log(`[Node Processing ${currentProcessingUrl}] Database insertion success. Template ID: ${templateId}`);

      return NextResponse.json({
        originalUrl: currentProcessingUrl,
        status: 'success',
        message: 'Reel processed and template created successfully.',
        templateId,
        finalVideoUrl,
        posterUrl,
        analysis,
        suggestedName,
      } as SingleProcessingResult, { status: 200 });

    } catch (err: any) {
      console.error(`[Node Processing ${currentProcessingUrl}] Error during Node.js processing stage: ${err.message}`, err);
      return NextResponse.json({
        originalUrl: currentProcessingUrl,
        status: 'processing_error',
        message: `Error during server-side processing: ${err.message}`,
        finalVideoUrl, // Include for context
      } as SingleProcessingResult, { status: 500 });
    }

  } catch (error: any) {
    console.error('[API /api/scrape-reels] Unhandled error in POST handler:', error);
    // Use originalUrlInput if available, otherwise indicate it was too early to capture
    const errorUrl = originalUrlInput || 'Unknown (error before URL parsing)';
    return NextResponse.json({
        originalUrl: errorUrl,
        status: 'processing_error', // Or a more generic 'server_error'
        message: error.message || 'An unexpected error occurred on the server.',
    } as SingleProcessingResult, { status: 500 });
  }
} 