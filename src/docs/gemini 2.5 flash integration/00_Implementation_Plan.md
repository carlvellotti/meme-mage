# Implementation Plan: AI-Assisted Template Creation and Review Workflow

## Goal

To streamline the meme template creation process by:
1.  Leveraging AI (Gemini 2.5 Pro) to automatically generate initial template names and detailed instructions/analysis based on scraped video content and example captions.
2.  Replacing the "unprocessed templates" workflow with a new admin review system for AI-generated templates before they become publicly visible.

## High-Level Steps

1.  **Setup & Environment:** Configure the necessary environment variables and install the required Google AI SDK. (Completed)
    *   [Details: 01_Setup_and_Env.md](./01_Setup_and_Env.md)

2.  **Prompt Engineering:** Design a specific prompt for Gemini to analyze video/caption and generate a name and structured Markdown analysis. (Completed)
    *   [Details: 02_Prompt_Engineering.md](./02_Prompt_Engineering.md)

3.  **Backend Analysis API Route:** Create a new Next.js API route (`/api/analyze-video-template`) that accepts a video URL and optional example caption, interacts with the Gemini 2.5 Pro model, and returns the generated name and analysis. (Completed)
    *   [Details: 03_Backend_API_Route.md](./03_Backend_API_Route.md)

4.  **Backend Scraper Updates:** Modify the `/api/scrape-reels` endpoint to call the analysis API, generate embeddings, and insert new templates directly into the main `templates` table with `reviewed = false`.
    *   [Details: 04_Backend_Scraper_Updates.md](./04_Backend_Scraper_Updates.md)

5.  **Backend Review APIs:** Create API endpoints (`GET /api/templates?reviewed=false`, `PATCH /api/templates/:id`, `DELETE /api/templates/:id`) to fetch, update (name/instructions/reviewed status, including re-vectorization), and delete templates.
    *   [Details: 05_Backend_Review_APIs.md](./05_Backend_Review_APIs.md)

6.  **Frontend Review UI:** Develop a new admin component (`UnreviewedTemplatesTable`) to display unreviewed templates and provide UI for editing, approving, and deleting them.
    *   [Details: 06_Frontend_Review_UI.md](./06_Frontend_Review_UI.md)

7.  **Cleanup:** Remove the old `unprocessed_templates` table, associated API routes, and frontend components.
    *   [Details: 07_Cleanup.md](./07_Cleanup.md)

8.  **Testing & Refinement:** Thoroughly test the entire end-to-end workflow, assess AI output quality, and refine implementation based on results.
    *   [Details: 08_Testing_and_Refinement.md](./08_Testing_and_Refinement.md) 