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

    // --- Wrap spawn in a Promise to wait for completion ---
    const runPythonScript = (): Promise<{ code: number | null; stdout: string; stderr: string }> => {
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
          resolve({ code, stdout, stderr }); // Resolve the promise when the process closes
        });

        pythonProcess.on('error', (err) => {
          console.error('[API /api/scrape-reels] Failed to start Python subprocess.', err);
          reject(err); // Reject the promise if spawning fails
        });
      });
    };

    // --- Execute the script and wait for the result ---
    try {
      const { code, stdout, stderr } = await runPythonScript();

      if (code === 0) {
        console.log('[API /api/scrape-reels] Python script completed successfully. Responding 200 OK.');
        return NextResponse.json({ 
          message: `Successfully processed ${urls.length} URLs.`, 
          output: stdout // Optionally include stdout in response
        });
      } else {
        console.error(`[API /api/scrape-reels] Python script failed with code ${code}. Responding 500.`);
        return NextResponse.json({ 
          error: `Python script failed with exit code ${code}.`, 
          details: stderr // Include stderr for debugging
        }, { status: 500 });
      }
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