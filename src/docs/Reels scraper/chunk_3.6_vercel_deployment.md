# Reels Scraper Integration: Chunk 3.6 - Vercel Deployment Fix

## 1. Goal

Deploy the integrated Instagram Reels scraper functionality (frontend components, Python backend logic, and API route) to Vercel successfully.

## 2. Problem Encountered

After restoring the necessary files (frontend components, API route, Python scripts) from commit `b5d10d5` and ensuring local functionality using `npm run dev` (and later `vercel dev` after identifying the issue), deployment to Vercel fails.

*   **Symptom:** The `/api/scrape-reels` endpoint returns a 500 error when called from the deployed frontend (`ReelScraperForm`).
*   **Root Cause (Vercel Runtime Logs):** The Node.js API route (`src/app/api/scrape-reels/route.ts`) attempts to execute the Python script (`src/lib/meme-scraper/process_reels.py`) using `child_process.spawn`. This fails with an `Error: spawn python ENOENT` (or `Error: spawn python3 ENOENT`).
*   **Reason:** The standard Vercel **Node.js Serverless Function runtime environment does not include a pre-installed Python executable (`python` or `python3`)** in its PATH. Configuration files like `requirements.txt` and `.python-version` signal Vercel to prepare a *Python* runtime environment, but they do not inject Python into the separate *Node.js* runtime environment where `/api/scrape-reels/route.ts` executes.

## 3. Attempts Made (and why they failed)

*   **Explicitly calling `python3`:** Failed (`ENOENT`) because `python3` executable is not present in the Node.js runtime PATH.
*   **Explicitly calling `python`:** Failed (`ENOENT`) because `python` executable is not present in the Node.js runtime PATH.
*   **Setting `PYTHON_EXECUTABLE=python` Env Var:** Failed because the variable correctly instructed the Node.js code to look for `python`, but that executable still wasn't present in the Node.js runtime PATH.
*   **Moving `requirements.txt` to root:** Correctly placed for Vercel Python runtime builds, but irrelevant as the function was still using the Node.js runtime.
*   **Adding `.python-version`:** Correctly specifies Python version for Vercel Python runtime builds, but irrelevant as the function was still using the Node.js runtime.
*   **Using `vercel.json` `includeFiles`:** Correctly included the Python *script* files in the deployment package, but didn't provide the Python *runtime* needed to execute them from Node.js.

## 4. Proposed Solution (The Vercel Way)

Refactor the API endpoint to natively use Vercel's Python Serverless Function runtime instead of trying to bridge from Node.js to Python via `spawn`.

**Steps:**

1.  **Delete/Rename Node.js Route:** Remove or rename the existing Node.js API route handler `src/app/api/scrape-reels/route.ts` to avoid conflicts.
2.  **Create Python API Endpoint:** Create a new file at `api/scrape_reels.py` (Note: Place directly in the root `api/` directory, not `src/app/api/`).
3.  **Implement Python Handler:** Inside `api/scrape_reels.py`, use a Python web framework (e.g., Flask or Vercel's BaseHTTPRequestHandler) to define an HTTP handler function that:
    *   Listens for POST requests at the `/api/scrape-reels` path.
    *   Parses the incoming JSON request body to get the list of URLs.
    *   Imports the necessary functions directly from `src/lib/meme-scraper/process_reels.py`.
    *   Calls the imported Python functions to perform the scraping and processing logic.
    *   Returns an appropriate JSON response (success or error) to the client.
4.  **Dependencies:** Ensure the root `requirements.txt` includes all necessary packages for both the web handler (e.g., `Flask`) and the scraper logic itself. Vercel will automatically detect `api/scrape_reels.py` and use the Python runtime, installing these dependencies.
5.  **Local Development:** Use `vercel dev` for local testing, which supports multiple runtimes.

This approach aligns with Vercel's intended use of different runtimes for different serverless functions within the same project.

## 5. Implementation & Troubleshooting (`vercel dev`)

Following the proposed solution, the following steps were taken:

1.  **Deleted Node.js Route:** `src/app/api/scrape-reels/route.ts` was removed.
2.  **Created Python API:** `api/scrape_reels.py` was created using Flask, importing logic from `src/lib/meme-scraper/process_reels.py`.
3.  **Added Dependencies:** `Flask` was added to the root `requirements.txt`.
4.  **Initial `vercel dev` Test:** Failed with 404 errors. The `vercel dev` logs showed no attempt to recognize or route to the Python function.
5.  **Troubleshooting `vercel dev` 404s:**
    *   Modified Flask route within `api/scrape_reels.py` from `/api/scrape-reels` to `/`.
    *   Investigated `vercel.json`: Found a `functions` configuration potentially overriding root `api` discovery. Emptied `vercel.json` (`{}`).
    *   Changed file structure: Moved code from `api/scrape_reels.py` to `api/scrape-reels/index.py` (adjusting relative imports).
    *   Simplified API Code: Replaced Flask app with minimal `BaseHTTPRequestHandler` in `api/scrape-reels/index.py`.
    *   Tested Different Path: Created a separate minimal handler at `api/ping/index.py`.
    *   Checked Environment: Verified local Python 3.9 installation, Node.js version, ran `vercel pull`.
    *   Debug Logs (`vercel dev --debug`): Consistently showed `vercel dev` ignoring the `api` directory and Python files, jumping straight to running `next dev`.
    *   Explicit Build Config: Created `vercel.json` with `"builds": [{ "src": "api/**/*.py", "use": "@vercel/python" }]` to force builder usage.
    *   Reinstalled Vercel CLI: Completely reinstalled `vercel` CLI.

*   **Outcome:** Despite all attempts, `vercel dev` consistently failed to recognize and route to the Python API endpoints locally.

## 6. Deployment Attempt & Size Limit Fix

*   Given the failures of `vercel dev`, an attempt was made to deploy the configuration (Flask app at `api/scrape-reels/index.py`, `vercel.json` with explicit build) via a Git push.
*   **Build Failure:** The Vercel deployment build failed with `Error: A Serverless Function has exceeded the unzipped maximum size of 250 MB.`
*   **Root Cause:** The `opencv-python` dependency in `requirements.txt` was identified as the cause due to its large size.
*   **Fix:** Replaced `opencv-python` with `opencv-python-headless` in `requirements.txt`.
*   **Second Deployment Attempt:** Build successful after the dependency change.

## 7. Current Status

*   The codebase includes a functional Python API route (`api/scrape-reels/index.py`) using Flask.
*   `vercel.json` explicitly defines the Python build configuration.
*   `requirements.txt` uses the smaller `opencv-python-headless` package.
*   **Local development via `vercel dev` remains non-functional for the Python API endpoint.**
*   The Vercel deployment build **succeeded** after fixing the function size limit.
*   Runtime testing of the deployed API endpoint is the next step. 