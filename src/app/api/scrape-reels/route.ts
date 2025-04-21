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
  originalUrl: string;
  error?: string;
}

// Define structure for processing results
interface ProcessingResult {
  originalUrl: string;
  status: 'success' | 'python_error' | 'processing_error' | 'db_error';
  message: string;
  templateId?: string; // If successfully inserted
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const urls: string[] = body.urls;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid URLs array in request body' }, { status: 400 });
    }

    // --- Security TODO: Implement authentication/authorization check here ---
    // In a real application, verify the user has permission to perform this action.
    console.log(`[API /api/scrape-reels] Received request to scrape ${urls.length} URLs:`, urls);

    // Define path to the Python script
    const scriptDir = path.resolve(process.cwd(), 'src/lib/meme-scraper');
    const scriptPath = path.join(scriptDir, 'process_reels.py');
    const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python3'; // Use env var or default

    console.log(`[API /api/scrape-reels] Script directory: ${scriptDir}`);
    console.log(`[API /api/scrape-reels] Script path: ${scriptPath}`);
    console.log(`[API /api/scrape-reels] Python executable: ${pythonExecutable}`);

    // Prepare environment variables for the Python script
    // Ensure required variables are passed from the Next.js environment
    const scriptEnv = {
        ...process.env, // Inherit existing env vars
        SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        // NODE_API_BASE_URL: process.env.NODE_API_BASE_URL || 'http://localhost:3000', // No longer needed by Python
        GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS, // Or your specific key variable
        // Add any other necessary env vars for the scraper here
    };

    // Validate essential env vars needed by the script
    if (!scriptEnv.SUPABASE_DB_URL) {
      console.error('[API /api/scrape-reels] Error: SUPABASE_DB_URL environment variable is not set for the API route.');
      return NextResponse.json({ error: 'Server configuration error: Missing database URL.' }, { status: 500 });
    }
    
    if (!scriptEnv.SUPABASE_SERVICE_KEY && !scriptEnv.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[API /api/scrape-reels] Error: Neither SUPABASE_SERVICE_KEY nor SUPABASE_SERVICE_ROLE_KEY environment variable is set.');
      return NextResponse.json({ error: 'Server configuration error: Missing Supabase service key.' }, { status: 500 });
    }

    // Array to hold processing results for each URL
    const processingResults: ProcessingResult[] = [];

    // --- Wrap spawn in a Promise to wait for completion ---
    const runPythonScript = (): Promise<PythonScrapeResult[] | null> => {
      return new Promise((resolve, reject) => {
        console.log(`[API /api/scrape-reels] Spawning Python script...`);
        const pythonProcess = spawn(pythonExecutable, [scriptPath, ...urls], {
          cwd: scriptDir,
          env: scriptEnv,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          output.split('\n').forEach((line: string) => {
            if (line.trim()) {
              console.log(`[Python STDOUT]: ${line.trim()}`);
            }
          });
        });

        pythonProcess.stderr.on('data', (data) => {
          const errorOutput = data.toString();
          stderr += errorOutput;
          errorOutput.split('\n').forEach((line: string) => {
            if (line.trim()) {
              console.error(`[Python STDERR]: ${line.trim()}`);
            }
          });
        });

        pythonProcess.on('close', (code) => {
          console.log(`[API /api/scrape-reels] Python script finished with code ${code}.`);
          if (code !== 0) {
            console.error(`[API /api/scrape-reels] Python script exited with non-zero code ${code}. Stderr: ${stderr}`);
            // Reject or resolve with null/error indicator if needed, depends on how you handle batch errors
            // For now, we resolve null, assuming Node.js will handle URLs it didn't get results for
            resolve(null); 
          } else {
            // Process stdout line by line, expecting one JSON object per line
            const results: PythonScrapeResult[] = stdout
              .split('\n')
              .filter(line => line.trim().startsWith('{') && line.trim().endsWith('}')) // Basic JSON line check
              .map(line => {
                try {
                  return JSON.parse(line.trim()) as PythonScrapeResult;
                } catch (parseError) {
                  console.error(`[API /api/scrape-reels] Failed to parse JSON line from Python stdout: ${line}`, parseError);
                  return null; // Mark line as failed parse
                }
              })
              .filter(result => result !== null) as PythonScrapeResult[]; // Filter out nulls from failed parses
            resolve(results);
          }
        });

        pythonProcess.on('error', (err) => {
          console.error('[API /api/scrape-reels] Failed to start Python subprocess.', err);
          reject(err); // Reject the promise if spawning fails
        });
      });
    };

    // --- Execute the script and wait for the result ---
    try {
      const pythonResults = await runPythonScript();

      if (!pythonResults) {
         console.error('[API /api/scrape-reels] Python script execution failed or returned no results.');
         // Populate results for all URLs as python_error
         urls.forEach(url => processingResults.push({ originalUrl: url, status: 'python_error', message: 'Python script failed to execute or returned invalid data.' }));
      } else {
         // Process results returned from Python
         console.log(`[API /api/scrape-reels] Received ${pythonResults.length} results from Python.`);
         const resultsMap = new Map(pythonResults.map(r => [r.originalUrl, r]));

         for (const url of urls) {
           const result = resultsMap.get(url);

           if (!result || !result.success || !result.finalVideoUrl) {
             const message = result?.error || 'Python script did not return successful data for this URL.';
             console.error(`[API /api/scrape-reels] Python error for ${url}: ${message}`);
             processingResults.push({ originalUrl: url, status: 'python_error', message });
             continue; // Skip to next URL
           }

           // --- Start Node.js processing for successful Python scrape ---
           const { finalVideoUrl, captionText, instagramId, originalUrl } = result;
           let posterUrl: string | null = null;
           let analysis: string | null = null;
           let suggestedName: string | null = `Untitled Template - ${instagramId}`;
           let embeddingVector: number[] | null = null;
           let templateId: string | undefined = undefined;
           let processingError: string | null = null;
           let dbError: string | null = null;

           try {
              console.log(`[Node Processing ${originalUrl}] Starting API calls...`);
              // 1. Generate Thumbnail
              try {
                const thumbResponse = await fetch(new URL('/api/generate-thumbnail', req.url).toString(), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ videoUrl: finalVideoUrl }),
                });
                if (thumbResponse.ok) {
                  posterUrl = (await thumbResponse.json()).thumbnailUrl;
                  console.log(`[Node Processing ${originalUrl}] Thumbnail success: ${posterUrl}`);
                } else {
                  console.error(`[Node Processing ${originalUrl}] Thumbnail API failed: ${thumbResponse.status} ${await thumbResponse.text()}`);
                }
              } catch (e: any) {
                console.error(`[Node Processing ${originalUrl}] Thumbnail API fetch error: ${e.message}`);
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
                  console.log(`[Node Processing ${originalUrl}] Analysis success. Name: ${suggestedName}`);
                } else {
                  console.error(`[Node Processing ${originalUrl}] Analysis API failed: ${analyzeResponse.status} ${await analyzeResponse.text()}`);
                  analysis = 'Analysis failed.'; // Set placeholder on error
                }
              } catch (e: any) {
                console.error(`[Node Processing ${originalUrl}] Analysis API fetch error: ${e.message}`);
                analysis = 'Analysis failed.'; // Set placeholder on error
              }

              // 3. Generate Embedding (only if analysis exists)
              if (analysis) {
                 try {
                   embeddingVector = await generateEmbedding(analysis);
                   console.log(`[Node Processing ${originalUrl}] Embedding success. Length: ${embeddingVector?.length}`);
                 } catch (e: any) {
                   console.error(`[Node Processing ${originalUrl}] Embedding generation error: ${e.message}`);
                   embeddingVector = null; // Set to null on error
                 }
              } else {
                 console.warn(`[Node Processing ${originalUrl}] Skipping embedding: analysis is empty.`);
              }

           } catch (err: any) {
              console.error(`[Node Processing ${originalUrl}] Error during API calls: ${err.message}`);
              processingError = err.message;
           }

           // 4. Insert into Database (only if no critical processing error occurred)
           if (!processingError) {
               try {
                   console.log(`[Node Processing ${originalUrl}] Inserting into database...`);
                   const { data, error } = await supabaseAdmin
                       .from('meme_templates')
                       .insert({
                           name: suggestedName,
                           video_url: finalVideoUrl,
                           poster_url: posterUrl,
                           instructions: analysis,
                           original_source_url: originalUrl,
                           embedding: embeddingVector,
                           reviewed: false, // Mark as unreviewed
                           uploader_name: 'Scraper'
                       })
                       .select('id') // Select the ID of the inserted row
                       .single();

                   if (error) {
                       throw error;
                   }
                   templateId = data?.id;
                   console.log(`[Node Processing ${originalUrl}] Database insert successful. ID: ${templateId}`);

               } catch (err: any) {
                   console.error(`[Node Processing ${originalUrl}] Database insert error:`, err);
                   dbError = err.message || 'Unknown database error';
               }
           }

           // Determine final status for this URL
           if (dbError) {
               processingResults.push({ originalUrl, status: 'db_error', message: `DB insert failed: ${dbError}` });
           } else if (processingError) {
               processingResults.push({ originalUrl, status: 'processing_error', message: `API processing failed: ${processingError}` });
           } else {
               processingResults.push({ originalUrl, status: 'success', message: 'Successfully processed and added for review.', templateId });
           }
         }
      }

      // --- Return final results --- 
      console.log("[API /api/scrape-reels] Processing complete. Final results:", processingResults);
      return NextResponse.json({ results: processingResults });

    } catch (spawnError) {
       // Handle errors during the spawning process itself (e.g., python not found)
        console.error('[API /api/scrape-reels] Error executing Python script:', spawnError);
        return NextResponse.json({ error: 'Failed to execute backend processing script.' }, { status: 500 });
    }

  } catch (error) {
    console.error('[API /api/scrape-reels] Unexpected error in POST handler:', error);
    // Check if the error is related to JSON parsing
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 