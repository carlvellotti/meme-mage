# Tech Specs: Step 1 - Setup & Environment

## Objective
Prepare the development environment by setting up the necessary API key and installing the Google AI client library.

## Tasks

1.  **Configure Environment Variable:**
    *   Add the Google AI API key to the project's local environment file.
    *   **File:** `.env.local` (Create if it doesn't exist)
    *   **Variable:** `GOOGLE_API_KEY`
    *   **Content:**
        ```
        GOOGLE_API_KEY="YOUR_ACTUAL_GOOGLE_AI_API_KEY"
        # Add other environment variables below if needed
        NEXT_PUBLIC_SUPABASE_URL=...
        NEXT_PUBLIC_SUPABASE_ANON_KEY=...
        SUPABASE_SERVICE_ROLE_KEY=...
        # ... etc
        ```
    *   **Security:** Ensure `.env.local` is listed in your `.gitignore` file to prevent accidental commits of the API key.

2.  **Install SDK:**
    *   Add the official Google AI Node.js SDK package to the project dependencies.
    *   **Command (choose one):
        ```bash
        npm install @google/generative-ai
        ```
        or
        ```bash
        yarn add @google/generative-ai
        ```
    *   **Verification:** Check `package.json` to confirm `@google/generative-ai` is listed under dependencies.

## Outcome

*   The `GOOGLE_API_KEY` is securely configured and accessible within the backend environment.
*   The `@google/generative-ai` library is installed and ready for use in the backend API routes. 