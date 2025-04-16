'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'

interface ReelScraperFormProps {
  onProcessingComplete?: () => void;
}

export function ReelScraperForm({ onProcessingComplete }: ReelScraperFormProps) {
  const [urlsText, setUrlsText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Parse URLs (one per line)
      const urls = urlsText
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      if (urls.length === 0) {
        throw new Error('Please enter at least one Instagram Reel URL')
      }

      // Call the API endpoint
      const response = await fetch('/api/scrape-reels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls }),
      })

      if (!response.ok) {
        let errorData: { error?: string } = {};
        try {
            errorData = await response.json();
        } catch (jsonError) {
            // Handle cases where the response is not valid JSON
            throw new Error(`Failed to process Reels. Status: ${response.status}`);
        }
        throw new Error(errorData.error || 'Failed to process Reels')
      }

      // Success
      toast.success(`Processing initiated for ${urls.length} ${urls.length === 1 ? 'URL' : 'URLs'}`)
      setUrlsText('') // Clear the textarea
      
      // Notify parent component if callback provided
      if (onProcessingComplete) {
        onProcessingComplete()
      }
    } catch (err) {
      console.error('Error submitting URLs:', err)
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 bg-gray-800 p-6 rounded-lg border border-gray-700 mt-8">
      <h2 className="text-xl font-bold text-white">Process Instagram Reels (Works for Carl only)</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="urls-input" className="block text-sm font-medium text-gray-300 mb-2">
            Instagram Reel URLs (one per line)
          </label>
          <textarea
            id="urls-input"
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            className="w-full p-3 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 min-h-[120px]"
            placeholder="https://www.instagram.com/reel/example1/\nhttps://www.instagram.com/reel/example2/"
            disabled={loading}
            required // Added basic required attribute
          />
        </div>

        <button
          type="submit"
          disabled={loading || !urlsText.trim()}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            'Process Reels'
          )}
        </button>

        {error && (
          <div className="text-red-400 text-sm mt-2 p-2 bg-red-900/30 rounded border border-red-700">{error}</div>
        )}
      </form>
    </div>
  )
} 