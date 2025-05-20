'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'

interface ReelScraperFormProps {
  onProcessingComplete?: (results: ProcessedUrlResult[]) => void; // Callback with all results
  onSingleUrlProcessed?: (result: ProcessedUrlResult) => void; // Callback for each URL
}

export interface ProcessedUrlResult {
  originalUrl: string;
  status: 'success' | 'error' | 'pending' | 'processing';
  message?: string;
  templateId?: string;
  finalVideoUrl?: string;
  posterUrl?: string;
  analysis?: string;
  suggestedName?: string;
  exampleCaptions?: string[]; // Added to reflect parsed input for greenscreen
  isGreenscreen?: boolean; // Added to reflect mode
}

interface SingleApiResponse {
  originalUrl: string;
  status: 'success' | 'python_error' | 'processing_error' | 'db_error' | 'script_setup_error';
  message: string;
  templateId?: string;
  finalVideoUrl?: string;
  posterUrl?: string;
  analysis?: string;
  suggestedName?: string;
}

export function ReelScraperForm({ onProcessingComplete, onSingleUrlProcessed }: ReelScraperFormProps) {
  const [urlsText, setUrlsText] = useState('')
  const [overallLoading, setOverallLoading] = useState(false)
  const [processedUrls, setProcessedUrls] = useState<ProcessedUrlResult[]>([])
  const [currentTask, setCurrentTask] = useState<string | null>(null)
  const [isGreenscreenMode, setIsGreenscreenMode] = useState(false); // New state for greenscreen mode

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setOverallLoading(true)
    setCurrentTask('Starting processing...')
    setProcessedUrls([]) // Clear previous results

    const lines = urlsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      toast.error('Please enter at least one URL')
      setOverallLoading(false)
      setCurrentTask(null)
      return
    }

    const urlsToProcess: Array<{ url: string; exampleCaptions: string[] }> = lines.map(line => {
      const parts = line.split(',');
      const url = parts[0].trim();
      const exampleCaptions = parts.slice(1).map(c => c.trim()).filter(c => c.length > 0);
      return { url, exampleCaptions };
    });

    const resultsAccumulator: ProcessedUrlResult[] = [];
    // Initialize pending states for all URLs
    setProcessedUrls(urlsToProcess.map(item => ({
      originalUrl: item.url, 
      status: 'pending', 
      exampleCaptions: item.exampleCaptions, 
      isGreenscreen: isGreenscreenMode 
    })));

    for (let i = 0; i < urlsToProcess.length; i++) {
      const currentItem = urlsToProcess[i];
      const currentUrl = currentItem.url;
      const currentExampleCaptions = currentItem.exampleCaptions;

      setCurrentTask(`Processing URL ${i + 1} of ${urlsToProcess.length}: ${currentUrl}`);
      setProcessedUrls(prev => 
        prev.map(p => p.originalUrl === currentUrl ? { ...p, status: 'processing' } : p)
      );

      try {
        const requestBody: any = { url: currentUrl, isGreenscreen: isGreenscreenMode };
        if (isGreenscreenMode && currentExampleCaptions.length > 0) {
          requestBody.exampleCaptions = currentExampleCaptions;
        }

        const response = await fetch('/api/scrape-reels', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const resultData: SingleApiResponse = await response.json();
        let processedResult: ProcessedUrlResult;

        if (response.ok && resultData.status === 'success') {
          toast.success(`Successfully processed: ${currentUrl}`);
          processedResult = {
            originalUrl: currentUrl,
            status: 'success',
            message: resultData.message,
            templateId: resultData.templateId,
            finalVideoUrl: resultData.finalVideoUrl,
            posterUrl: resultData.posterUrl,
            analysis: resultData.analysis,
            suggestedName: resultData.suggestedName,
            isGreenscreen: isGreenscreenMode, // Carry over the mode
            exampleCaptions: isGreenscreenMode ? currentExampleCaptions : undefined // Store if relevant
          };
        } else {
          const errorMsg = resultData.message || `Failed to process URL. Status: ${response.status}`;
          toast.error(`Error processing ${currentUrl}: ${errorMsg}`);
          processedResult = {
            originalUrl: currentUrl,
            status: 'error',
            message: errorMsg,
            isGreenscreen: isGreenscreenMode,
            exampleCaptions: isGreenscreenMode ? currentExampleCaptions : undefined
          };
        }
        resultsAccumulator.push(processedResult);
        if (onSingleUrlProcessed) {
          onSingleUrlProcessed(processedResult);
        }
        setProcessedUrls(prev => 
          prev.map(p => p.originalUrl === currentUrl ? processedResult : p)
        );

      } catch (err) {
        console.error(`Error submitting URL ${currentUrl}:`, err);
        const errorMessage = err instanceof Error ? err.message : 'An unexpected network error occurred';
        toast.error(`Failed to submit ${currentUrl}: ${errorMessage}`);
        const errorResult: ProcessedUrlResult = {
          originalUrl: currentUrl,
          status: 'error',
          message: errorMessage,
          isGreenscreen: isGreenscreenMode,
          exampleCaptions: isGreenscreenMode ? currentExampleCaptions : undefined
        };
        resultsAccumulator.push(errorResult);
        if (onSingleUrlProcessed) {
          onSingleUrlProcessed(errorResult);
        }
        setProcessedUrls(prev => 
          prev.map(p => p.originalUrl === currentUrl ? errorResult : p)
        );
      }
    }

    setCurrentTask(`All ${urlsToProcess.length} URLs processed.`);
    setOverallLoading(false);
    if (onProcessingComplete) {
      onProcessingComplete(resultsAccumulator);
    }
  }

  return (
    <div className="space-y-6 bg-gray-800 p-6 rounded-lg border border-gray-700 mt-8">
      <h2 className="text-xl font-bold text-white">Process Instagram Reels & TikToks</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center space-x-3 mb-4">
          <input 
            type="checkbox" 
            id="greenscreen-mode-toggle"
            checked={isGreenscreenMode}
            onChange={(e) => setIsGreenscreenMode(e.target.checked)}
            disabled={overallLoading}
            className="h-5 w-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-offset-gray-800"
          />
          <label htmlFor="greenscreen-mode-toggle" className="text-sm font-medium text-gray-200">
            Process as Greenscreen (TikToks, etc.)
          </label>
        </div>

        <div>
          <label htmlFor="urls-input" className="block text-sm font-medium text-gray-300 mb-2">
            Video URLs (one per line)
            {isGreenscreenMode && <span className="text-xs text-gray-400"> - Optionally add comma-separated example captions after URL</span>}
          </label>
          <textarea
            id="urls-input"
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            className="w-full p-3 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 min-h-[120px]"
            placeholder={
              isGreenscreenMode 
              ? "https://www.tiktok.com/@user/video/123,Example caption one,Another example\nhttps://www.tiktok.com/@user/video/456"
              : "https://www.instagram.com/reel/example1/\nhttps://www.instagram.com/reel/example2/"
            }
            disabled={overallLoading}
            required
          />
           {isGreenscreenMode && (
            <p className="mt-2 text-xs text-gray-400">
              For greenscreen mode, you can provide example captions after the URL, separated by commas. E.g.:<br/>
              `https://www.tiktok.com/@user/video/123,This is a caption,This is another one`
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={overallLoading || !urlsText.trim()}
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-base font-medium"
        >
          {overallLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{currentTask || 'Processing...'}</span>
            </>
          ) : (
            `Process All ${isGreenscreenMode ? 'Greenscreen Videos' : 'Reels'} Listed`
          )}
        </button>
      </form>

      {processedUrls.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-lg font-semibold text-white">Processing Status:</h3>
          <ul className="space-y-2 max-h-96 overflow-y-auto p-3 bg-gray-700/50 rounded-md border border-gray-600">
            {processedUrls.map((result, index) => (
              <li key={index} className={`p-3 rounded-md text-sm ${result.status === 'success' ? 'bg-green-700/30 border border-green-600' : result.status === 'error' ? 'bg-red-700/30 border border-red-600' : result.status === 'processing' ? 'bg-yellow-700/30 border border-yellow-600 animate-pulse' : 'bg-gray-600/30 border border-gray-500'}`}>
                <div className="font-medium truncate text-white">{result.originalUrl} {result.isGreenscreen && <span className="text-xs px-1.5 py-0.5 bg-purple-600 rounded-sm">GS</span>}</div>
                <div className={`capitalize font-semibold ${result.status === 'success' ? 'text-green-300' : result.status === 'error' ? 'text-red-300' : result.status === 'processing' ? 'text-yellow-300' : 'text-gray-300'}`}>
                  Status: {result.status}
                </div>
                {result.message && <div className="text-xs text-gray-400 mt-1">Message: {result.message}</div>}
                {result.isGreenscreen && result.exampleCaptions && result.exampleCaptions.length > 0 && (
                  <div className="text-xs text-purple-300 mt-1">
                    Provided Captions: {result.exampleCaptions.join('; ')}
                  </div>
                )}
                {result.status === 'success' && result.templateId && (
                  <div className="text-xs text-green-400 mt-1">Template ID: {result.templateId}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 