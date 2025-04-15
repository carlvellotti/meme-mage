import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

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

    // Spawn the Python process
    console.log(`[API /api/scrape-reels] Spawning Python script...`);
    const pythonProcess = spawn(pythonExecutable, [scriptPath, ...urls], {
        cwd: scriptDir, // Set working directory to the script's location
        env: scriptEnv,
        stdio: ['ignore', 'pipe', 'pipe'], // stdin, stdout, stderr
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      // Log Python output lines individually for better readability
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

    // Handle process exit - This happens *after* the API has responded
    pythonProcess.on('close', (code) => {
      console.log(`[API /api/scrape-reels] Python script finished with code ${code}.`);
      if (code !== 0) {
        console.error(`[API /api/scrape-reels] Python script failed. Final STDERR:
${stderr}`);
        // TODO CHUNK 3/4: Implement more robust error handling/notification.
        // - Could involve updating DB records for the affected URLs to 'failed'.
        // - Could send a notification (e.g., via WebSocket or to an admin dashboard).
      } else {
        console.log(`[API /api/scrape-reels] Python script completed successfully. Final STDOUT:
${stdout}`);
        // TODO CHUNK 3/4: Potentially trigger follow-up actions or notifications.
        // - Notify frontend via WebSocket?
        // - Mark batch as completed?
      }
    });

    pythonProcess.on('error', (err) => {
        console.error('[API /api/scrape-reels] Failed to start Python subprocess.', err);
        // This usually indicates a problem finding the python executable or the script itself.
        // TODO: Notify admin or implement fallback?
    });

    // Respond immediately to the client - DO NOT wait for the Python script to finish.
    console.log('[API /api/scrape-reels] Responding 202 Accepted to client.');
    return NextResponse.json({ message: `Processing initiated for ${urls.length} URLs. Check server logs for progress.` }, { status: 202 });

  } catch (error) {
    console.error('[API /api/scrape-reels] Unexpected error in POST handler:', error);
    // Check if the error is related to JSON parsing
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 