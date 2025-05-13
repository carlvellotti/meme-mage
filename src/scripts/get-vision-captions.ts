import { spawn } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local or .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });


interface PythonScrapeResult {
  success: boolean;
  captionText?: string;
  originalUrl: string;
  error?: string;
  // Other fields from the Python script's output will be ignored
}

async function getCaptionsForUrls(urls: string[]): Promise<void> {
  if (!urls || urls.length === 0) {
    console.error('No URLs provided.');
    process.exit(1);
  }

  const scriptDir = path.resolve(process.cwd(), 'src/lib/meme-scraper');
  const scriptPath = path.join(scriptDir, 'process_reels.py');
  const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python3';

  // Essential environment variables for the Python script
  const scriptEnv = {
    ...process.env, // Inherit existing env vars
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    // The Python script might require other env vars like Supabase,
    // even if we don't use that data here.
    // Add them if errors occur.
    // SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
    // NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    // SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(`Executing Python script: ${scriptPath} with ${pythonExecutable}`);
  console.log(`Processing ${urls.length} URL(s):`, urls);

  try {
    const pythonProcess = spawn(pythonExecutable, [scriptPath, ...urls], {
      cwd: scriptDir,
      env: scriptEnv,
      stdio: ['ignore', 'pipe', 'pipe'], // stdin, stdout, stderr
    });

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
      // Log Python stdout directly for debugging if needed
      // process.stdout.write(`[PYTHON_STDOUT]: ${data.toString()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      process.stderr.write(`[PYTHON_STDERR]: ${data.toString()}`);
    });

    pythonProcess.on('close', (code) => {
      console.log(`\nPython script finished with code ${code}.`);

      if (code !== 0) {
        console.error(`Python script exited with error. Check STDERR above.`);
        // stderrData already printed
        process.exit(1);
      }

      console.log('\n--- Vision Caption Results ---');
      const results: PythonScrapeResult[] = stdoutData
        .split('\n')
        .filter(line => line.trim().startsWith('{') && line.trim().endsWith('}'))
        .map(line => {
          try {
            return JSON.parse(line.trim()) as PythonScrapeResult;
          } catch (parseError: any) {
            console.error(`Failed to parse JSON line from Python stdout: ${line.substring(0,100)}...`, parseError.message);
            return null;
          }
        })
        .filter(result => result !== null) as PythonScrapeResult[];

      if (results.length === 0 && stdoutData.trim() !== '') {
          console.warn("No structured JSON results found in Python script output, though output was received.");
          console.log("Full Python STDOUT:", stdoutData);
      } else if (results.length === 0) {
          console.warn("No results received from Python script.");
      }


      const outputMap = new Map<string, string>();
      urls.forEach(url => {
        const result = results.find(r => r.originalUrl === url);
        if (result) {
          if (result.success && result.captionText) {
            outputMap.set(url, result.captionText);
            console.log(`URL: ${url}\nCaption: ${result.captionText}\n---`);
          } else {
            const errorMessage = result.error || 'Caption not found or processing failed.';
            outputMap.set(url, `Error: ${errorMessage}`);
            console.log(`URL: ${url}\nError: ${errorMessage}\n---`);
          }
        } else {
          outputMap.set(url, 'Error: No result returned from Python script for this URL.');
          console.log(`URL: ${url}\nError: No result returned from Python script for this URL.\n---`);
        }
      });
      // Optionally, you could return this map or write to a file
      // For command-line, printing is usually sufficient.
    });

    pythonProcess.on('error', (err) => {
      console.error('Failed to start Python subprocess.', err);
      process.exit(1);
    });

  } catch (error: any) {
    console.error('Error executing Python script:', error.message);
    process.exit(1);
  }
}

// --- Main execution ---
if (require.main === module) {
  const args = process.argv.slice(2); // Get arguments after script name
  if (args.length === 0) {
    console.log('Usage: tsx src/scripts/get-vision-captions.ts <url1> [url2 ...]');
    console.log('Or: node dist/scripts/get-vision-captions.js <url1> [url2 ...]'); // If compiled
    process.exit(1);
  }
  getCaptionsForUrls(args).catch(err => {
    console.error("Script failed:", err);
    process.exit(1);
  });
}

// For potential programmatic use (though not the primary request)
export { getCaptionsForUrls }; 