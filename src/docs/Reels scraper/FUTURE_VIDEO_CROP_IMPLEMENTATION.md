# Future Implementation: Fixing Video Crop Timeouts on Vercel

## Problem Summary

The API endpoint `/api/templates/[id]/crop` successfully uses static `ffmpeg` and `ffprobe` binaries (located in `/bin`) to crop videos when tested.

However, when deployed to Vercel on the **Hobby plan**, the endpoint fails with a **504 Gateway Timeout**. This occurs because the total execution time (downloading the original video, running ffprobe, running ffmpeg crop, uploading the cropped video) exceeds the Hobby plan's maximum serverless function duration (typically 10-15 seconds).

The Vercel logs confirm that `ffmpeg` finishes successfully, but the process times out during or just after initiating the upload of the cropped video back to Supabase storage. Uploading potentially large files is a common cause for timeouts in synchronous serverless functions.

## Solution: Background Job Processing

To reliably handle this long-running task within Vercel's limitations (especially on the Hobby plan), the video cropping process must be moved to a background job.

### High-Level Workflow

1.  **API Endpoint (Trigger):**
    *   The `/api/templates/[id]/crop` endpoint should receive the request and validate the crop payload.
    *   Instead of performing the crop, it should create a record in a database table (e.g., a `crop_jobs` table in Supabase) containing the necessary information (template ID, crop parameters, user ID if applicable, initial status like 'pending').
    *   It should immediately return a `202 Accepted` response to the client, possibly including a job ID.
    *   **Crucially:** This API endpoint will now be very fast and won't time out.

2.  **Background Worker:**
    *   A separate process needs to pick up pending jobs from the `crop_jobs` table.
    *   This worker will perform the actual download, ffprobe, ffmpeg crop, and upload logic (similar to the code currently in the API route).
    *   Upon completion (success or failure), the worker updates the job status in the `crop_jobs` table (e.g., 'completed', 'failed') and stores the URL of the cropped video or any error message.

3.  **Frontend Update:**
    *   The frontend needs to handle the initial `202 Accepted` response.
    *   It should then periodically poll a new API endpoint (e.g., `/api/crop-jobs/[jobId]/status`) to check the status of the job.
    *   Alternatively, use real-time subscriptions (e.g., Supabase Realtime) to listen for changes to the job status in the database.
    *   Once the job status is 'completed', the frontend can fetch the new video URL and update the UI.

### Implementation Options for Background Worker

Several options exist for running the background worker:

*   **Vercel Cron Jobs + Serverless Function:**
    *   Create a Vercel Cron Job that triggers a *separate* Vercel Serverless Function (e.g., `/api/process-crop-job`) periodically (e.g., every minute).
    *   This function queries the `crop_jobs` table for pending jobs.
    *   **Challenge:** This worker function *still* has the same maximum execution timeout based on your Vercel plan. If a single crop job takes longer than the timeout, this approach won't work directly unless you process jobs incrementally or use the Pro plan for longer function durations (up to 900s with Cron).
*   **Supabase Edge Functions:**
    *   Trigger a Supabase Edge Function when a new row is inserted into `crop_jobs` (using Supabase Function Hooks).
    *   Edge Functions have a longer timeout (potentially up to 60 seconds or more, check current Supabase limits) and might be sufficient.
    *   **Challenge:** Need to ensure `ffmpeg`/`ffprobe` can be run within the Deno environment of Supabase Edge Functions (might require WebAssembly versions or calling external services).
*   **Third-Party Job Queue Services (e.g., Inngest, Quirrel, Zeplo):**
    *   These services are designed specifically for background jobs and often integrate well with Vercel.
    *   The API endpoint sends a job to the service.
    *   The service calls back to another API endpoint in your Vercel app to execute the job, often with built-in retries, longer timeouts, etc.
    *   Probably the most robust solution but adds another service dependency.
*   **Dedicated Server/Container:** (Outside Vercel Serverless) Run a persistent worker process elsewhere that polls the database. Least "serverless" approach.

### Next Steps (When Ready)

1.  Choose a background processing strategy (Vercel Cron + Pro Function, Supabase Edge Functions, or a third-party queue seem most appropriate).
2.  Design the `crop_jobs` database table schema.
3.  Refactor the current `/api/templates/[id]/crop` endpoint to only create a job record and return `202`.
4.  Implement the background worker function based on the chosen strategy, reusing the existing download/crop/upload logic.
5.  Implement the frontend polling or real-time subscription logic to check job status and display the result.

This documentation assumes the codebase is at the state where the static binaries in `/bin` are functional but cause timeouts.
