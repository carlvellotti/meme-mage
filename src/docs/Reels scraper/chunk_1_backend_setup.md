# Reels Scraper Integration: Chunk 1 - Backend Setup & Basic Scraping API

## 1. Goals

*   Establish the necessary database schema in Supabase for storing unprocessed templates.
*   Modify the Python scraper's database interaction logic to connect to and write basic data (URL, initial status) to the Supabase table.
*   Create the Next.js API route (`/api/scrape-reels`) capable of receiving URLs and triggering the Python script (`process_reels.py`).
*   Ensure environment variables (Supabase credentials, Google Cloud Vision Key placeholder) can be passed from the Next.js API route to the Python script execution context.

*Initial focus is on connectivity and basic data flow, not yet including file uploads to Supabase Storage or full processing.*

## 2. Technical Outline

### 2.1. Supabase Schema

*   **Create Table:** Define and create the `unprocessed_templates` table in the Supabase public schema via the Supabase Studio UI or a SQL script.
    ```sql
    CREATE TABLE public.unprocessed_templates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        instagram_url text NOT NULL,
        caption_text text NULL, -- Initially NULL
        cropped_video_url text NULL, -- Initially NULL
        thumbnail_url text NULL, -- Initially NULL
        status text NOT NULL DEFAULT 'pending', -- e.g., pending, processing, completed, failed
        error_message text NULL,
        created_at timestamp with time zone NOT NULL DEFAULT now()
    );
    ```
*   **RLS Policies:** Define basic RLS policies. Initially, allow authenticated users to read, and enable insert operations (likely restricted via the API route later). Service key usage from the backend will bypass RLS for inserts initially.
    *   Example (adjust as needed): `CREATE POLICY "Allow authenticated read access" ON public.unprocessed_templates FOR SELECT USING (auth.role() = 'authenticated');`
    *   Example (service role bypasses this for inserts): `CREATE POLICY "Allow admin insert access" ON public.unprocessed_templates FOR INSERT WITH CHECK (false); -- Service role bypasses`
*   **Environment Variables:** Ensure Supabase URL (`NEXT_PUBLIC_SUPABASE_URL`) and Service Role Key (`SUPABASE_SERVICE_KEY`) are defined in your project's `.env.local` or environment variable provider. Add `GOOGLE_APPLICATION_CREDENTIALS` or specific Vision API key env var.

### 2.2. Python Scraper Modifications (`src/lib/meme-scraper/`)

*   **Dependencies:** Add `psycopg2-binary` to `src/lib/meme-scraper/requirements.txt`.
    ```
    # requirements.txt additions
    psycopg2-binary
    ```
*   **Database Connection (`db_manager.py` or equivalent):**
    *   Import `os` and `psycopg2`.
    *   Read Supabase connection details from environment variables (`SUPABASE_DB_URL` or individual host/user/pass/db vars passed from Node). A connection string is often easiest.
    *   Modify connection logic to use `psycopg2.connect()` with the Supabase DSN.
    *   Create a new function like `insert_pending_reel(instagram_url)` that inserts a new row into `unprocessed_templates` with the URL and status 'pending'.
    ```python
    # pseudocode for db_manager.py modification
    import os
    import psycopg2

    def get_db_connection():
        # Option 1: Using a full DSN (Database URL from Supabase settings)
        db_url = os.environ.get("SUPABASE_DB_URL")
        if not db_url:
            raise ValueError("SUPABASE_DB_URL environment variable not set")
        conn = psycopg2.connect(db_url)
        return conn

        # Option 2: Individual parameters (if preferred)
        # host = os.environ.get("SUPABASE_DB_HOST")
        # ... etc ...
        # conn = psycopg2.connect(host=host, ...)

    def insert_pending_reel(instagram_url):
        conn = None
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            # Insert just the URL and default status
            cur.execute(
                "INSERT INTO unprocessed_templates (instagram_url, status) VALUES (%s, %s) RETURNING id",
                (instagram_url, 'processing') # Or 'pending' initially, updated later
            )
            reel_id = cur.fetchone()[0]
            conn.commit()
            cur.close()
            print(f"Inserted pending reel with ID: {reel_id}")
            return reel_id # Return the ID for potential future use in the script run
        except (Exception, psycopg2.DatabaseError) as error:
            print(f"Database error: {error}")
            # Optionally update status to 'failed' here if ID was obtained
            return None
        finally:
            if conn is not null:
                conn.close()

    # Modify existing store_memes or process_reels logic:
    # Instead of inserting final data, it might initially just update the status
    # based on processing success/failure. Full data insertion comes after file uploads (Chunk 3).
    ```
*   **Processing Script (`process_reels.py`):**
    *   Modify the main loop or function that handles each URL.
    *   *Before* starting download/processing for a URL, call `insert_pending_reel(url)` to create the initial DB entry.
    *   Retrieve necessary environment variables (like `GOOGLE_APPLICATION_CREDENTIALS` path or key content) using `os.environ.get()`.
    *   For this chunk, the script *doesn't* need to fully succeed in processing or uploading files yet. Focus is on the initial insert and ensuring the script can be called.

### 2.3. Next.js API Route (`src/app/api/scrape-reels/route.ts`)

*   **Create File:** `src/app/api/scrape-reels/route.ts`.
*   **Handler Function:** Create an async `POST` handler.
    ```typescript
    // src/app/api/scrape-reels/route.ts
    import { NextRequest, NextResponse } from 'next/server';
    import { spawn } from 'child_process';
    import path from 'path';

    export async function POST(req: NextRequest) {
      try {
        const body = await req.json();
        const urls: string[] = body.urls;

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
          return NextResponse.json({ error: 'Missing or invalid URLs array' }, { status: 400 });
        }

        // --- Security TODO: Add authentication check here ---
        // e.g., check user session or API key

        console.log(`Received request to scrape ${urls.length} URLs`);

        // Define path to the Python script
        // IMPORTANT: Adjust this path based on your project structure and deployment environment
        const scriptDir = path.resolve(process.cwd(), 'src/lib/meme-scraper'); // Navigate to the scraper dir
        const scriptPath = path.join(scriptDir, 'process_reels.py');
        const pythonExecutable = 'python3'; // Or 'python', ensure it's in PATH

        // Prepare environment variables for the Python script
        const scriptEnv = {
            ...process.env, // Inherit existing env vars
            SUPABASE_DB_URL: process.env.SUPABASE_DB_URL, // Pass the DB connection string
            // Example for Google Cloud Vision API Key:
            // Option A: Pass path to credentials file (if available in execution env)
            // GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS_PATH,
            // Option B: Pass the key content directly (if stored in an env var)
            // GOOGLE_CREDENTIALS_CONTENT: process.env.GOOGLE_CREDENTIALS_JSON_CONTENT,
            // Python script needs to handle reading this env var accordingly
        };

        // Spawn the Python process
        const pythonProcess = spawn(pythonExecutable, [scriptPath, ...urls], {
            cwd: scriptDir, // Set working directory for the script
            env: scriptEnv,
            stdio: ['ignore', 'pipe', 'pipe'], // stdin, stdout, stderr
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          console.log(`[Python STDOUT]: ${output.trim()}`);
        });

        pythonProcess.stderr.on('data', (data) => {
          const errorOutput = data.toString();
          stderr += errorOutput;
          console.error(`[Python STDERR]: ${errorOutput.trim()}`);
        });

        // Handle process exit - THIS IS ASYNCHRONOUS
        // The API route should respond quickly, not wait for the script to finish.
        // Logging completion/errors happens here, but doesn't block the initial response.
        pythonProcess.on('close', (code) => {
          console.log(`Python script exited with code ${code}`);
          if (code !== 0) {
            console.error(`Python script failed. STDERR: ${stderr}`);
            // TODO: Implement proper error handling/notification (e.g., update DB status)
          } else {
            console.log(`Python script completed successfully. STDOUT: ${stdout}`);
            // TODO: Potentially update DB status for processed URLs
          }
        });

        pythonProcess.on('error', (err) => {
            console.error('Failed to start Python subprocess.', err);
            // TODO: Implement proper error handling/notification
        });

        // Respond immediately to the client
        return NextResponse.json({ message: `Processing initiated for ${urls.length} URLs.` }, { status: 202 }); // 202 Accepted

      } catch (error) {
        console.error('Error in /api/scrape-reels:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
      }
    }
    ```
*   **Execution Considerations:** Ensure the environment where the Next.js API route runs has `python3` (or `python`) in its `PATH` and can execute the script. Test path resolution (`process.cwd()`, `path.join`).

## 3. Testing Checklist

*   [ ] **Database:** Can connect to the Supabase database from a local Python environment using `psycopg2` and environment variables?
*   [ ] **Database:** Does running the modified `process_reels.py` (or the test `insert_pending_reel` function) manually create a new row in the `unprocessed_templates` table with the correct URL and `status`?
*   [ ] **Python Script:** Does the Python script correctly receive command-line arguments (URLs) when run manually?
*   [ ] **Python Script:** Does the Python script correctly access environment variables passed to it (e.g., `SUPABASE_DB_URL`)?
*   [ ] **API Route:** Does sending a POST request (e.g., using `curl`, Postman, or a simple test frontend) with a valid URL array to `/api/scrape-reels` return a `202 Accepted` status?
*   [ ] **API Route:** Does the API route log indicate that the Python script process was spawned?
*   [ ] **API Route:** Do the Next.js server logs show `[Python STDOUT]` messages from the script?
*   [ ] **End-to-End (Simulated):** Does the entire flow (API -> Python -> Simulated DB Insert -> API Log) work as expected?

## 4. Chunk 1 Implementation Notes & Key Decisions

*   **Virtual Environment Required:** Initial `pip install` attempts failed due to the system Python being `externally-managed` (PEP 668). Creating and activating a Python virtual environment (`python3 -m venv .venv` and `source .venv/bin/activate`) before running `pip install -r requirements.txt` was necessary.
*   **Relative Import Issue:** The Python script initially failed with `ImportError: attempted relative import with no known parent package` because it was being run directly, not as part of a package. Changed `from .db_utils import ...` to `from db_utils import ...` as the API route sets the `cwd` correctly.
*   **Missing Dependency:** The `requests` library was missing from the initial `requirements.txt` but required by imported modules. Added `requests>=2.0.0`.
*   **Direct DB Connection Failure:** Attempts to connect directly to the Supabase PostgreSQL database using the `SUPABASE_DB_URL` (e.g., `postgresql://...` or `postgres://...`) failed with a DNS resolution error (`could not translate host name "db.xxx.supabase.co" to address...`). This is expected behaviour as Supabase typically restricts direct DB access from external networks.
*   **Decision: Simulate DB for Chunk 1 Test:** To verify the API-to-script communication flow without resolving the DB connection method immediately, the `db_utils.py` module was modified to *simulate* database connection and insertion, printing logs and returning fake data. This allowed successful end-to-end testing of the Chunk 1 infrastructure.
*   **Decision: Defer DB Connection Method:** The actual method for Python to interact with Supabase (e.g., using the `supabase-py` client library via REST API, edge functions, or potentially configuring database access differently) will be addressed and implemented in **Chunk 3 (Storage Integration)**.