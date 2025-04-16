# Reels Scraper Integration: Chunk 4 - Testing, Deployment & Monitoring

## 1. Goals

*   Develop comprehensive testing procedures for the entire scraper integration.
*   Configure deployment environments for both development and production.
*   Implement monitoring and logging to track scraper performance and errors.
*   Create documentation for maintenance and troubleshooting.

## 2. Technical Outline

### 2.1. Testing Procedures

*   **Backend API Testing:**
    *   Update/create tests to verify the API endpoint functionality (now synchronous).
    ```typescript
    // src/app/api/scrape-reels/__tests__/route.test.ts
    
    import { POST } from '../route';
    import { NextRequest } from 'next/server';
    import { spawn } from 'child_process';
    
    // Mock child_process.spawn to simulate different outcomes
    const mockSpawn = (exitCode: number, stderr = '') => {
      return jest.fn(() => {
        const mockProcess = {
          stdout: {
            on: jest.fn((event, callback) => {
              if (event === 'data') callback('Processing...'); // Simulate some output
            }),
          },
          stderr: {
            on: jest.fn((event, callback) => {
              if (event === 'data') callback(stderr);
            }),
          },
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              // Simulate async completion
              process.nextTick(() => callback(exitCode)); 
            }
            if (event === 'error') {
              // Optionally simulate spawn error
            }
            return mockProcess;
          }),
        };
        return mockProcess;
      });
    };
    
    describe('/api/scrape-reels', () => {
      let originalSpawn: typeof spawn;
      
      beforeEach(() => {
        // Store original spawn and reset mocks
        originalSpawn = require('child_process').spawn;
        jest.resetModules(); // Reset modules to re-require child_process
      });

      afterEach(() => {
        // Restore original spawn
        require('child_process').spawn = originalSpawn;
      });
      
      it('returns 400 for invalid requests', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/scrape-reels', {
          method: 'POST',
          body: JSON.stringify({ invalidProp: 'value' }),
        });
        const response = await POST(mockRequest);
        expect(response.status).toBe(400);
      });
      
      it('returns 200 OK when Python script succeeds (exit code 0)', async () => {
        // Mock spawn for success
        require('child_process').spawn = mockSpawn(0);
        
        const mockRequest = new NextRequest('http://localhost:3000/api/scrape-reels', {
          method: 'POST',
          body: JSON.stringify({ urls: ['https://www.instagram.com/reel/test1'] }),
        });
        
        const response = await POST(mockRequest);
        expect(response.status).toBe(200);
        
        const data = await response.json();
        expect(data.message).toContain('Successfully processed');
        expect(require('child_process').spawn).toHaveBeenCalled();
      });

      it('returns 500 error when Python script fails (non-zero exit code)', async () => {
        // Mock spawn for failure
        require('child_process').spawn = mockSpawn(1, 'Python script error message');

        const mockRequest = new NextRequest('http://localhost:3000/api/scrape-reels', {
          method: 'POST',
          body: JSON.stringify({ urls: ['https://www.instagram.com/reel/test-fail'] }),
        });

        const response = await POST(mockRequest);
        expect(response.status).toBe(500);

        const data = await response.json();
        expect(data.error).toContain('Python script failed');
        expect(data.details).toContain('Python script error message');
        expect(require('child_process').spawn).toHaveBeenCalled();
      });

      // Add test for spawn error itself if needed
    });
    ```

*   **Frontend Component Testing:**
    *   Update `ReelScraperForm` tests to check for loading toast and API success/error handling (now synchronous).
    ```typescript
    // src/app/components/__tests__/ReelScraperForm.test.tsx
    
    import { render, screen, fireEvent, waitFor } from '@testing-library/react';
    import { ReelScraperForm } from '../ReelScraperForm';
    import { toast } from 'react-hot-toast';
    
    // Mock fetch and toast
    global.fetch = jest.fn();
    jest.mock('react-hot-toast', () => ({
      toast: {
        success: jest.fn(),
        error: jest.fn(),
        loading: jest.fn((msg) => msg), // Return message as ID for update
        dismiss: jest.fn(), // Add dismiss if used
      },
    }));
    
    describe('ReelScraperForm', () => {
      beforeEach(() => {
        jest.clearAllMocks();
        // Reset fetch mock for each test
        (global.fetch as jest.Mock).mockReset(); 
      });
      
      it('renders the form with textarea and button', () => {
        render(<ReelScraperForm />);
        
        expect(screen.getByLabelText(/instagram reel urls/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /process reels/i })).toBeInTheDocument();
      });
      
      it('disables the button when textarea is empty', () => {
        render(<ReelScraperForm />);
        
        const button = screen.getByRole('button', { name: /process reels/i });
        expect(button).toBeDisabled();
      });
      
      it('enables the button when text is entered', () => {
        render(<ReelScraperForm />);
        
        const textarea = screen.getByLabelText(/instagram reel urls/i);
        fireEvent.change(textarea, { target: { value: 'https://instagram.com/reel/test' } });
        
        const button = screen.getByRole('button', { name: /process reels/i });
        expect(button).not.toBeDisabled();
      });
      
      it('submits URLs, shows loading toast, and success on API success', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Success message from API' }),
        });
        
        const onProcessingComplete = jest.fn();
        render(<ReelScraperForm onProcessingComplete={onProcessingComplete} />);
        
        const textarea = screen.getByLabelText(/instagram reel urls/i);
        fireEvent.change(textarea, { target: { value: 'https://instagram.com/reel/test' } });
        
        const button = screen.getByRole('button', { name: /process reels/i });
        fireEvent.click(button);

        // Check loading toast was shown
        expect(toast.loading).toHaveBeenCalledWith('Processing Reels...');
        // Check button shows loading state
        expect(screen.getByText(/processing.../i)).toBeInTheDocument();
        
        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith('/api/scrape-reels', expect.anything());
        });
        
        // Check success toast (potentially updating loading toast)
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Success message'), expect.any(Object));
        expect(onProcessingComplete).toHaveBeenCalled();
        expect(textarea).toHaveValue(''); 
        // Check button is enabled again
        expect(screen.getByRole('button', { name: /process reels/i })).not.toBeDisabled();
      });
      
      it('shows error toast on API error', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'API Error Details' }),
        });
        
        render(<ReelScraperForm />);
        
        const textarea = screen.getByLabelText(/instagram reel urls/i);
        fireEvent.change(textarea, { target: { value: 'https://instagram.com/reel/test-err' } });
        
        const button = screen.getByRole('button', { name: /process reels/i });
        fireEvent.click(button);

        expect(toast.loading).toHaveBeenCalledWith('Processing Reels...');
        
        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalled();
        });

        // Check error toast (potentially updating loading toast)
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('API Error Details'), expect.any(Object));
        // Check internal error display (if implemented)
        // expect(screen.getByText(/api error details/i)).toBeInTheDocument(); 
        // Check button is enabled again
        expect(screen.getByRole('button', { name: /process reels/i })).not.toBeDisabled();
      });
    });
    ```
    *   Add tests for `UnprocessedTemplatesTable` focusing on rendering completed items, pagination, and modal functionality.
    *   Add tests for `TemplateUploader` focusing on handling initial props and the delete call on submit.

*   **Verify Python Logic:**
    *   Update `test_storage_uploader.py` if needed.
    *   Update `test_e2e.py` to reflect any changes in `process_reels.py` or `db_manager.py` (e.g., removal of existence check).

### 2.2. Deployment Configuration

*   **Development/Production Environments:**
    *   Update `.env.development` / `.env.production` / Vercel Environment Variables to include all required keys (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_DB_URL`, `GOOGLE_APPLICATION_CREDENTIALS` or Vision API Key, potentially `PYTHON_EXECUTABLE` path if not standard `python3`).
    *   Ensure the Python environment where the script runs (local `python3`, Vercel function runtime, Docker container) has all dependencies from `src/lib/meme-scraper/requirements.txt` installed (including pinned `httpx==0.27.2`).
    *   Ensure FFmpeg is installed in the execution environment.
    *   Ensure `libmagic` system dependency is installed if using `python-magic`.
*   **Deployment Considerations Document:**
    *   Update guide to reflect synchronous API call (potential timeout issues on serverless). Highlight need for Python/FFmpeg/dependencies in execution environment.

### 2.3. Monitoring and Logging

*   **Enhanced Logging:** Implement or verify robust logging within `process_reels.py` and helper modules.
*   **Database Monitoring View:** Verify `scraper_status_summary` view provides useful metrics.
*   **Dashboard API & Component:** Implement or verify `api/scraper-status` route and `ScraperMonitor` component.

### 2.4. Maintenance Documentation

*   **Troubleshooting Guide:** Update guide with debugging steps for synchronous API errors, Python dependency issues (`ModuleNotFoundError`, version conflicts), and potential timeouts.
*   **Database Schema:** Document the `original_source_url` column in `meme_templates` and the potential removal of the `UNIQUE` constraint on `instagram_url` in `unprocessed_templates`.

## 3. Testing Checklist (Reflects Final State)

*   [ ] **Backend API Tests:**
    *   [ ] Unit tests for `/api/scrape-reels` pass (mocking sync completion).
    *   [ ] Handles invalid input (400).
    *   [ ] Returns 200 OK on mocked script success.
    *   [ ] Returns 500 error on mocked script failure.

*   [ ] **Frontend Component Tests:**
    *   [ ] `ReelScraperForm` tests pass (including sync API call checks).
    *   [ ] `UnprocessedTemplatesTable` tests pass (renders completed, pagination, modal).
    *   [ ] `TemplateUploader` tests pass (handles initial props, delete call).

*   [ ] **Python Logic Tests:**
    *   [ ] `StorageUploader` tests pass.
    *   [ ] E2E test script successfully processes a URL (without duplicate checks).

*   [ ] **Deployment Configuration:**
    *   [ ] Environment variables configured correctly for deployment target.
    *   [ ] Python dependencies (incl. pinned versions) installed in target environment.
    *   [ ] FFmpeg installed in target environment.
    *   [ ] `libmagic` installed if needed.

*   [ ] **Monitoring & Logging:**
    *   [ ] Python script logs are informative.
    *   [ ] Monitoring dashboard API works.
    *   [ ] Dashboard component renders status.

*   [ ] **Documentation:**
    *   [ ] Troubleshooting guide updated.
    *   [ ] Schema changes documented. 