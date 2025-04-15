# Reels Scraper Integration: Chunk 4 - Testing, Deployment & Monitoring

## 1. Goals

*   Develop comprehensive testing procedures for the entire scraper integration.
*   Configure deployment environments for both development and production.
*   Implement monitoring and logging to track scraper performance and errors.
*   Create documentation for maintenance and troubleshooting.

## 2. Technical Outline

### 2.1. Testing Procedures

*   **Backend API Testing:**
    *   Create a testing script to verify the API endpoint functionality.
    ```typescript
    // src/app/api/scrape-reels/__tests__/route.test.ts
    
    import { POST } from '../route';
    import { NextRequest } from 'next/server';
    import { spawn } from 'child_process';
    
    // Mock child_process.spawn
    jest.mock('child_process', () => {
      return {
        spawn: jest.fn(() => {
          const mockProcess = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
              if (event === 'close') {
                callback(0); // Mock successful exit
              }
              return mockProcess;
            }),
          };
          return mockProcess;
        }),
      };
    });
    
    describe('/api/scrape-reels', () => {
      it('returns 400 for invalid requests', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/scrape-reels', {
          method: 'POST',
          body: JSON.stringify({ invalidProp: 'value' }),
        });
        
        const response = await POST(mockRequest);
        expect(response.status).toBe(400);
        
        const data = await response.json();
        expect(data.error).toBeTruthy();
      });
      
      it('spawns Python process for valid requests', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/scrape-reels', {
          method: 'POST',
          body: JSON.stringify({ urls: ['https://www.instagram.com/reel/test1'] }),
        });
        
        const response = await POST(mockRequest);
        expect(response.status).toBe(202);
        
        expect(spawn).toHaveBeenCalled();
        const spawnArgs = (spawn as jest.Mock).mock.calls[0];
        expect(spawnArgs[1]).toContain('process_reels.py');
      });
    });
    ```

*   **Frontend Component Testing:**
    *   Create tests for the ReelScraperForm component:
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
      },
    }));
    
    describe('ReelScraperForm', () => {
      beforeEach(() => {
        jest.clearAllMocks();
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
      
      it('submits URLs and displays success message on successful API call', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Success' }),
        });
        
        const onProcessingComplete = jest.fn();
        render(<ReelScraperForm onProcessingComplete={onProcessingComplete} />);
        
        const textarea = screen.getByLabelText(/instagram reel urls/i);
        fireEvent.change(textarea, { target: { value: 'https://instagram.com/reel/test' } });
        
        const button = screen.getByRole('button', { name: /process reels/i });
        fireEvent.click(button);
        
        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith(
            '/api/scrape-reels',
            expect.objectContaining({
              method: 'POST',
              body: JSON.stringify({ urls: ['https://instagram.com/reel/test'] }),
            })
          );
        });
        
        expect(toast.success).toHaveBeenCalled();
        expect(onProcessingComplete).toHaveBeenCalled();
        expect(textarea).toHaveValue(''); // textarea should be cleared
      });
      
      it('displays error message on API error', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'API Error' }),
        });
        
        render(<ReelScraperForm />);
        
        const textarea = screen.getByLabelText(/instagram reel urls/i);
        fireEvent.change(textarea, { target: { value: 'https://instagram.com/reel/test' } });
        
        const button = screen.getByRole('button', { name: /process reels/i });
        fireEvent.click(button);
        
        await waitFor(() => {
          expect(toast.error).toHaveBeenCalled();
        });
        
        expect(screen.getByText(/api error/i)).toBeInTheDocument();
      });
    });
    ```

*   **Verify Python Uploader:**
    *   Create a test script for the storage uploader:
    ```python
    # meme-scraper copy/test_storage_uploader.py
    
    import os
    import unittest
    from storage_uploader import StorageUploader
    
    class TestStorageUploader(unittest.TestCase):
        def setUp(self):
            # Create a test file
            self.test_file_path = "test_upload.txt"
            with open(self.test_file_path, "w") as f:
                f.write("Test content for upload")
                
            # Ensure environment variables are set
            required_vars = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_KEY']
            for var in required_vars:
                if not os.environ.get(var):
                    self.skipTest(f"Environment variable {var} not set")
    
        def tearDown(self):
            # Clean up test file
            if os.path.exists(self.test_file_path):
                os.remove(self.test_file_path)
    
        def test_content_type_detection(self):
            uploader = StorageUploader()
            content_type = uploader.get_content_type(self.test_file_path)
            self.assertEqual(content_type, "text/plain")
    
        def test_upload_file(self):
            uploader = StorageUploader()
            success, result = uploader.upload_file(
                self.test_file_path, 
                "unprocessed-thumbnails", 
                "test_upload.txt"
            )
            
            self.assertTrue(success)
            self.assertTrue(result.startswith(uploader.supabase_url))
            print(f"Uploaded to: {result}")
            
        def test_instagram_id_upload(self):
            uploader = StorageUploader()
            success, result = uploader.upload_thumbnail(
                self.test_file_path,
                "test_instagram_id"
            )
            
            self.assertTrue(success)
            self.assertIn("thumbnail_test_instagram_id", result)
    
    if __name__ == "__main__":
        unittest.main()
    ```

*   **End-to-End Testing Script:**
    ```python
    # meme-scraper copy/test_e2e.py
    
    import sys
    import os
    import time
    import psycopg2
    import argparse
    from db_manager import get_db_connection, insert_pending_reel
    from process_reels import process_url, extract_instagram_id
    
    def test_e2e(url):
        """Test end-to-end processing for a given URL"""
        print(f"\n--- Testing URL: {url} ---")
        
        # 1. Test database connection
        print("Testing database connection...")
        try:
            conn = get_db_connection()
            conn.close()
            print("✓ Database connection successful")
        except Exception as e:
            print(f"✗ Database connection failed: {e}")
            return False
        
        # 2. Test URL extraction
        print("\nTesting Instagram ID extraction...")
        try:
            instagram_id = extract_instagram_id(url)
            print(f"✓ Extracted ID: {instagram_id}")
        except Exception as e:
            print(f"✗ ID extraction failed: {e}")
            return False
        
        # 3. Test record insertion
        print("\nTesting database record insertion...")
        try:
            template_id = insert_pending_reel(url)
            print(f"✓ Inserted record with ID: {template_id}")
        except Exception as e:
            print(f"✗ Record insertion failed: {e}")
            return False
        
        # 4. Test full processing
        print("\nTesting full URL processing...")
        try:
            success = process_url(url)
            if success:
                print("✓ URL processing succeeded")
            else:
                print("✗ URL processing failed")
                return False
        except Exception as e:
            print(f"✗ Processing failed with exception: {e}")
            return False
        
        # 5. Verify database record is updated
        print("\nVerifying database record was updated...")
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute(
                "SELECT status, caption_text, cropped_video_url, thumbnail_url FROM unprocessed_templates WHERE id = %s",
                (template_id,)
            )
            record = cur.fetchone()
            conn.close()
            
            if not record:
                print("✗ Record not found in database")
                return False
                
            status, caption, video_url, thumbnail_url = record
            
            print(f"Status: {status}")
            print(f"Caption: {caption[:100]}..." if caption and len(caption) > 100 else f"Caption: {caption}")
            print(f"Video URL: {video_url}")
            print(f"Thumbnail URL: {thumbnail_url}")
            
            if status != 'completed':
                print("✗ Status is not 'completed'")
                return False
                
            if not video_url or not thumbnail_url:
                print("✗ Missing URLs in database record")
                return False
                
            print("✓ Database record properly updated")
            
        except Exception as e:
            print(f"✗ Database verification failed: {e}")
            return False
        
        print("\n--- Test completed successfully ---")
        return True
        
    if __name__ == "__main__":
        parser = argparse.ArgumentParser(description='Run end-to-end test for Instagram Reel processing')
        parser.add_argument('url', help='Instagram Reel URL to test')
        args = parser.parse_args()
        
        success = test_e2e(args.url)
        sys.exit(0 if success else 1)
    ```

### 2.2. Deployment Configuration

*   **Development Environment:**
    *   Create a development configuration for local testing.
    ```
    # .env.development (example)
    NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
    SUPABASE_SERVICE_KEY=<your-supabase-service-key>
    
    # Configure a local DSN to Supabase
    SUPABASE_DB_URL=postgres://<username>:<password>@<host>:<port>/<database>
    
    # Google Cloud Vision API Credentials (for caption extraction)
    GOOGLE_APPLICATION_CREDENTIALS=<path-to-credentials-file>
    # or GOOGLE_VISION_API_KEY=<your-api-key>
    
    # Python environment configuration
    PYTHON_PATH=/usr/bin/python3  # Or appropriate path for your system
    SCRAPER_DIR=meme-scraper copy
    ```

*   **Production Environment:**
    *   Deployment considerations document:
    ```markdown
    # Production Deployment Guide
    
    ## Requirements
    
    The production deployment must satisfy the following requirements:
    
    1. A server/VM/container with:
       - Python 3.7+ installed
       - FFmpeg installed
       - Node.js environment for Next.js
    2. Network access to:
       - Instagram (for video downloading)
       - Supabase (for database and storage)
       - Google Cloud (for Vision API)
    3. Sufficient storage for temporary video processing
    
    ## Options for Deployment
    
    ### Option 1: Integrated Next.js + Python (Same Server)
    
    - Deploy the Next.js app on a VM/container
    - Install Python, FFmpeg and all Python dependencies
    - Configure the API route to use the local Python installation
    - **Pros**: Simplest setup, no additional services
    - **Cons**: 
      - Scales vertically only
      - Processing can impact web server performance
      - Limited by serverless function timeouts if using Vercel/similar
    
    ### Option 2: Separate Next.js + Python Worker
    
    - Deploy Next.js on a serverless platform (e.g., Vercel)
    - Deploy Python scraper on a separate worker service (e.g., AWS EC2)
    - Configure Next.js API to call the worker service API instead of running Python locally
    - **Pros**:
      - Better isolation and scaling
      - No serverless function timeout limits
      - Web performance not impacted by processing
    - **Cons**:
      - More complex setup
      - Additional services to maintain
    
    ### Option 3: Queue-Based Architecture
    
    - Deploy Next.js app as usual
    - Use a message queue (e.g., AWS SQS, RabbitMQ)
    - API endpoint just adds messages to the queue
    - Separate worker service processes messages
    - **Pros**:
      - Most scalable and reliable
      - Decoupled architecture
      - Best for high-volume processing
    - **Cons**:
      - Most complex setup
      - Requires additional services for queue management
    
    ## Environment Variables
    
    The production environment must define the same variables as development:
    
    ```
    NEXT_PUBLIC_SUPABASE_URL=<production-supabase-url>
    SUPABASE_SERVICE_KEY=<production-service-key>
    SUPABASE_DB_URL=<production-database-connection-string>
    GOOGLE_APPLICATION_CREDENTIALS=<path-or-content>
    PYTHON_PATH=<path-to-python>
    SCRAPER_DIR=<path-to-scraper-directory>
    ```
    
    ## Deployment Steps
    
    1. Build the Next.js application
       ```
       npm run build
       ```
    
    2. Install Python dependencies in the production environment
       ```
       cd <SCRAPER_DIR>
       pip install -r requirements.txt
       ```
    
    3. Install FFmpeg (if not present)
       ```
       # Ubuntu/Debian
       apt-get update && apt-get install -y ffmpeg
       
       # CentOS/RHEL
       yum install -y ffmpeg
       ```
    
    4. Configure environment variables
    
    5. Start the application
       ```
       npm start
       ```
    
    6. Test the deployment with a sample reel URL
    ```

### 2.3. Monitoring and Logging

*   **Enhanced Logging for Python Scraper:**
    ```python
    # logging_config.py
    
    import os
    import logging
    import sys
    from datetime import datetime
    
    def setup_logging(log_dir="logs", log_level=logging.INFO):
        """Configure logging for the scraper"""
        # Create log directory if needed
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)
            
        # Create a unique log file name with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_file = os.path.join(log_dir, f"scraper_{timestamp}.log")
        
        # Configure root logger
        logger = logging.getLogger()
        logger.setLevel(log_level)
        
        # Clear existing handlers
        logger.handlers = []
        
        # Add file handler
        file_handler = logging.FileHandler(log_file)
        file_format = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        file_handler.setFormatter(file_format)
        logger.addHandler(file_handler)
        
        # Add console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_format = logging.Formatter('%(levelname)s: %(message)s')
        console_handler.setFormatter(console_format)
        logger.addHandler(console_handler)
        
        return logger, log_file
    ```

*   **Database Monitoring View:**
    ```sql
    -- Create a view for monitoring
    CREATE VIEW scraper_status_summary AS
    SELECT
        status,
        COUNT(*) as count,
        MIN(created_at) as oldest,
        MAX(created_at) as newest,
        AVG(EXTRACT(EPOCH FROM (CASE 
            WHEN status = 'completed' THEN 
                COALESCE(updated_at, now()) - created_at 
            ELSE 
                now() - created_at 
            END))) as avg_processing_time_seconds
    FROM
        unprocessed_templates
    GROUP BY
        status;
    ```

*   **Implement Dashboard API:**
    ```typescript
    // src/app/api/scraper-status/route.ts
    
    import { NextRequest, NextResponse } from 'next/server';
    import { createClient } from '@/lib/supabase/server';
    
    export async function GET(req: NextRequest) {
      try {
        const supabase = createClient();
        
        // Get status summary
        const { data: summary, error: summaryError } = await supabase
          .from('scraper_status_summary')
          .select('*');
          
        if (summaryError) throw summaryError;
        
        // Get recent errors (last 10)
        const { data: recentErrors, error: errorsError } = await supabase
          .from('unprocessed_templates')
          .select('id, instagram_url, error_message, created_at')
          .eq('status', 'failed')
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (errorsError) throw errorsError;
        
        // Get recent successful jobs (last 10)
        const { data: recentSuccess, error: successError } = await supabase
          .from('unprocessed_templates')
          .select('id, instagram_url, created_at')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (successError) throw successError;
        
        // Calculate total counts for each bucket
        const { data: bucketData, error: bucketError } = await supabase
          .storage
          .getBuckets();
          
        if (bucketError) throw bucketError;
        
        const response = {
          summary,
          recentErrors,
          recentSuccess,
          buckets: bucketData,
        };
        
        return NextResponse.json(response);
      } catch (error) {
        console.error('Error fetching scraper status:', error);
        return NextResponse.json(
          { error: 'Failed to fetch scraper status' }, 
          { status: 500 }
        );
      }
    }
    ```

*   **Basic Monitoring Dashboard Component:**
    ```tsx
    // src/app/components/ScraperMonitor.tsx
    
    'use client'
    
    import { useState, useEffect } from 'react'
    import { toast } from 'react-hot-toast'
    
    export function ScraperMonitor() {
      const [loading, setLoading] = useState(true)
      const [data, setData] = useState<any>(null)
      const [error, setError] = useState<string | null>(null)
      
      const fetchStatus = async () => {
        try {
          setLoading(true)
          const response = await fetch('/api/scraper-status')
          
          if (!response.ok) {
            throw new Error('Failed to fetch status')
          }
          
          const statusData = await response.json()
          setData(statusData)
          setError(null)
        } catch (err) {
          console.error('Error fetching status:', err)
          setError('Failed to load status data')
          toast.error('Failed to load monitoring data')
        } finally {
          setLoading(false)
        }
      }
      
      useEffect(() => {
        fetchStatus()
        
        // Refresh every 30 seconds
        const interval = setInterval(fetchStatus, 30000)
        return () => clearInterval(interval)
      }, [])
      
      if (loading && !data) {
        return (
          <div className="p-6 bg-gray-800 rounded-lg">
            <h2 className="text-xl font-bold text-white mb-4">Scraper Status</h2>
            <div className="flex justify-center">
              <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          </div>
        )
      }
      
      if (error) {
        return (
          <div className="p-6 bg-gray-800 rounded-lg">
            <h2 className="text-xl font-bold text-white mb-4">Scraper Status</h2>
            <div className="bg-red-900 bg-opacity-30 p-4 rounded-lg text-red-300">
              {error}
              <button 
                onClick={fetchStatus}
                className="mt-2 px-3 py-1 bg-red-700 text-white rounded text-sm hover:bg-red-600"
              >
                Retry
              </button>
            </div>
          </div>
        )
      }
      
      return (
        <div className="p-6 bg-gray-800 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Scraper Status</h2>
            <button
              onClick={fetchStatus}
              className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600"
            >
              Refresh
            </button>
          </div>
          
          {/* Status Summary */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {data.summary.map((status: any) => (
              <div 
                key={status.status} 
                className={`p-4 rounded-lg ${
                  status.status === 'completed' ? 'bg-green-900 bg-opacity-30' :
                  status.status === 'failed' ? 'bg-red-900 bg-opacity-30' :
                  status.status === 'processing' ? 'bg-blue-900 bg-opacity-30' :
                  'bg-yellow-900 bg-opacity-30'
                }`}
              >
                <h3 className="text-lg font-semibold text-white capitalize">{status.status}</h3>
                <p className="text-2xl font-bold text-white">{status.count}</p>
                <p className="text-sm text-gray-300 mt-1">
                  Avg Time: {Math.round(status.avg_processing_time_seconds / 60)} min
                </p>
              </div>
            ))}
          </div>
          
          {/* Recent Errors */}
          {data.recentErrors.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">Recent Errors</h3>
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-800">
                      <th className="px-4 py-2 text-left text-gray-300">URL</th>
                      <th className="px-4 py-2 text-left text-gray-300">Error</th>
                      <th className="px-4 py-2 text-left text-gray-300">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentErrors.map((err: any) => (
                      <tr key={err.id} className="border-t border-gray-800">
                        <td className="px-4 py-2 text-gray-300 truncate max-w-[200px]">
                          {err.instagram_url}
                        </td>
                        <td className="px-4 py-2 text-red-400 truncate max-w-[300px]">
                          {err.error_message}
                        </td>
                        <td className="px-4 py-2 text-gray-400">
                          {new Date(err.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Storage Stats */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Storage Buckets</h3>
            <div className="grid grid-cols-2 gap-4">
              {data.buckets.map((bucket: any) => (
                <div key={bucket.id} className="bg-gray-900 p-4 rounded-lg">
                  <p className="font-medium text-white">{bucket.name}</p>
                  <p className="text-gray-400 text-sm">Created: {new Date(bucket.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }
    ```

### 2.4. Maintenance Documentation

*   **Create Troubleshooting Guide:**
    ```markdown
    # Reels Scraper Troubleshooting Guide
    
    ## Common Issues
    
    ### 1. Failed to download video
    
    **Symptoms:** 
    - Error message in database: "Failed to download video"
    - No files generated for the URL
    
    **Possible Causes:**
    - Invalid or expired Instagram URL
    - Network connectivity issues
    - Instagram rate limiting
    - `yt-dlp` needs updating
    
    **Solutions:**
    - Verify the URL is valid and accessible in a browser
    - Check network connectivity to Instagram
    - If multiple URLs are failing, Instagram may be rate-limiting your IP
    - Update `yt-dlp`:
      ```
      pip install -U yt-dlp
      ```
    
    ### 2. Failed to extract frame
    
    **Symptoms:**
    - Error message: "Failed to extract frame"
    - Video may be downloaded but no frame is extracted
    
    **Possible Causes:**
    - Corrupted download
    - Unsupported video format
    - FFmpeg error
    
    **Solutions:**
    - Verify FFmpeg is installed and working
    - Try adjusting the time offset for frame extraction
    - Check the downloaded video file manually
    
    ### 3. Failed to crop video
    
    **Symptoms:**
    - Error message: "Failed to crop video"
    - Frame is extracted but cropping fails
    
    **Possible Causes:**
    - Video format issues
    - Content detection fails (unusual layout)
    - FFmpeg error
    
    **Solutions:**
    - Run the video cropper manually with verbose output
    - Check if the extracted frame shows the content clearly
    - Try different detection algorithms (see `video_cropper.py` options)
    
    ### 4. Failed to upload files to Supabase
    
    **Symptoms:**
    - Error message about thumbnail or video upload failure
    - Files may exist locally but not in Supabase Storage
    
    **Possible Causes:**
    - Invalid Supabase credentials
    - Network connectivity issues
    - Storage bucket permissions
    - File size limits
    
    **Solutions:**
    - Verify Supabase credentials in environment variables
    - Check network connectivity to Supabase
    - Verify bucket permissions in Supabase dashboard
    - Check file size limits for your Supabase tier
    
    ### 5. Caption extraction issues
    
    **Symptoms:**
    - Missing or incorrect captions
    - Google Vision API errors
    
    **Possible Causes:**
    - Invalid or expired Google credentials
    - Network connectivity to Google Cloud
    - Low quality or unusual text in images
    
    **Solutions:**
    - Verify Google Cloud Vision API credentials
    - Check network connectivity to Google Cloud
    - Try extracting the caption manually for specific frames
    
    ## Diagnostic Tools
    
    ### End-to-End Test
    
    Run the E2E test script with a known working URL:
    
    ```bash
    python test_e2e.py "https://www.instagram.com/reel/known_working_url"
    ```
    
    This will test each step and provide detailed output.
    
    ### Database Queries
    
    Check status distribution:
    
    ```sql
    SELECT status, COUNT(*) FROM unprocessed_templates GROUP BY status;
    ```
    
    Find recent errors:
    
    ```sql
    SELECT id, instagram_url, error_message, created_at 
    FROM unprocessed_templates 
    WHERE status = 'failed' 
    ORDER BY created_at DESC 
    LIMIT 10;
    ```
    
    ### Manual Processing
    
    Process a single URL with verbose output:
    
    ```bash
    PYTHONPATH=. python -m process_reels "https://www.instagram.com/reel/test_url" --verbose
    ```
    
    ### Storage Verification
    
    Verify storage credentials and bucket access:
    
    ```bash
    python -c "
    from storage_uploader import StorageUploader
    uploader = StorageUploader()
    print(f'Connected to Supabase: {uploader.supabase_url}')
    "
    ```
    
    ## Maintenance Tasks
    
    ### Regular Updates
    
    - Update `yt-dlp` regularly (Instagram often changes their site):
      ```bash
      pip install -U yt-dlp
      ```
    
    - Keep FFmpeg updated for new video formats
    
    ### Cleanup
    
    - Remove old temporary files:
      ```bash
      find ./videos -type f -mtime +7 -delete
      find ./frames -type f -mtime +7 -delete
      find ./cropped -type f -mtime +7 -delete
      ```
    
    - Archive old database entries:
      ```sql
      -- Example: Move entries older than 30 days to an archive table
      -- (Create archive table first with same schema)
      INSERT INTO unprocessed_templates_archive
      SELECT * FROM unprocessed_templates
      WHERE created_at < NOW() - INTERVAL '30 days';
      
      DELETE FROM unprocessed_templates
      WHERE created_at < NOW() - INTERVAL '30 days';
      ```
    ```

## 3. Testing Checklist

*   [ ] **Backend API Tests:**
    *   [ ] Do unit tests for the API route pass?
    *   [ ] Does it properly validate input?
    *   [ ] Does it successfully spawn the Python script?
    *   [ ] Does it handle errors gracefully?

*   [ ] **Frontend Component Tests:**
    *   [ ] Do the `ReelScraperForm` tests pass?
    *   [ ] Does the component validate input correctly?
    *   [ ] Does it show proper loading/error states?
    *   [ ] Does it clear the form on successful submission?

*   [ ] **Python Uploader Tests:**
    *   [ ] Does the `StorageUploader` test suite pass?
    *   [ ] Can it detect content types correctly?
    *   [ ] Can it upload to both buckets?
    *   [ ] Does it return valid, accessible URLs?

*   [ ] **End-to-End Testing:**
    *   [ ] Does the E2E test script successfully process a URL?
    *   [ ] Does it verify all steps in the process?
    *   [ ] Does it correctly report errors at each step?

*   [ ] **Deployment Configuration:**
    *   [ ] Are all necessary environment variables documented?
    *   [ ] Are both development and production environments configured?
    *   [ ] Is the deployment process documented and tested?
    *   [ ] Are there clear instructions for installing dependencies?

*   [ ] **Monitoring Dashboard:**
    *   [ ] Does the monitoring API return the correct data?
    *   [ ] Does the dashboard component render the data correctly?
    *   [ ] Does it auto-refresh at the configured interval?
    *   [ ] Does it show error states properly?

*   [ ] **Documentation:**
    *   [ ] Is the troubleshooting guide comprehensive?
    *   [ ] Are common issues documented with solutions?
    *   [ ] Are maintenance tasks clearly defined?
    *   [ ] Is there sufficient documentation for deployment? 