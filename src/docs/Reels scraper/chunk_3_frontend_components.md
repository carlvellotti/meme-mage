# Reels Scraper Integration: Chunk 2 - Frontend Components

## 1. Goals

*   Develop a user interface component (`ReelScraperForm.tsx`) for inputting Instagram Reel URLs.
*   Create a table component (`UnprocessedTemplatesTable.tsx`) to display unprocessed templates.
*   Implement communication with the API endpoint created in Chunk 1.
*   Enable selection and propagation of template data from the table to the existing `TemplateUploader` component.

## 2. Technical Outline

### 2.1. `ReelScraperForm.tsx` Component

*   **Create File:** Create a new React component file:

```tsx
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
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to process Reels')
      }

      // Success
      toast.success(`Processing initiated for ${urls.length} URLs`)
      setUrlsText('') // Clear the textarea
      
      // Notify parent component if callback provided
      if (onProcessingComplete) {
        onProcessingComplete()
      }
    } catch (err) {
      console.error('Error submitting URLs:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
      toast.error('Failed to process URLs')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 bg-gray-800 p-6 rounded-lg border border-gray-700 mt-8">
      <h2 className="text-xl font-bold text-white">Process Instagram Reels</h2>
      
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
            placeholder="https://www.instagram.com/reel/example1/&#10;https://www.instagram.com/reel/example2/"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !urlsText.trim()}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </span>
          ) : (
            'Process Reels'
          )}
        </button>

        {error && (
          <div className="text-red-400 text-sm mt-2">{error}</div>
        )}
      </form>
    </div>
  )
}
```

### 2.2. `UnprocessedTemplatesTable.tsx` Component

*   **Create File:** Create a new React component for displaying unprocessed templates:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'

// Define the UnprocessedTemplate type
interface UnprocessedTemplate {
  id: string
  instagram_url: string
  caption_text: string | null
  cropped_video_url: string | null
  thumbnail_url: string | null
  status: string
  error_message: string | null
  created_at: string
}

interface UnprocessedTemplatesTableProps {
  onTemplateSelect: (template: UnprocessedTemplate) => void;
  refreshTrigger?: number; // Optional prop to trigger refresh when value changes
}

export function UnprocessedTemplatesTable({ 
  onTemplateSelect,
  refreshTrigger = 0
}: UnprocessedTemplatesTableProps) {
  const [templates, setTemplates] = useState<UnprocessedTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch templates from Supabase
  const fetchTemplates = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('unprocessed_templates')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      setTemplates(data || [])
    } catch (err) {
      console.error('Error fetching templates:', err)
      setError('Failed to load templates')
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  // Fetch templates on component mount and when refreshTrigger changes
  useEffect(() => {
    fetchTemplates()
  }, [refreshTrigger])

  // Handle manual refresh
  const handleRefresh = () => {
    fetchTemplates()
    toast.success('Templates refreshed')
  }

  // Render status badge with appropriate color
  const StatusBadge = ({ status }: { status: string }) => {
    let bgColor = 'bg-gray-500'
    
    switch (status) {
      case 'completed':
        bgColor = 'bg-green-500'
        break
      case 'processing':
        bgColor = 'bg-blue-500'
        break
      case 'pending':
        bgColor = 'bg-yellow-500'
        break
      case 'failed':
        bgColor = 'bg-red-500'
        break
    }
    
    return (
      <span className={`px-2 py-1 text-xs rounded ${bgColor} text-white`}>
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-4 bg-gray-800 p-6 rounded-lg border border-gray-700 mt-8">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Unprocessed Templates</h2>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-4 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      
      {error && (
        <div className="text-red-400 text-sm">{error}</div>
      )}
      
      {loading && templates.length === 0 ? (
        <div className="py-8 text-center text-gray-400">
          <svg className="animate-spin h-8 w-8 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p>Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="py-8 text-center text-gray-400">
          <p>No unprocessed templates found.</p>
          <p className="text-sm mt-2">Use the form above to process Instagram Reels.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-700 text-left">
                <th className="px-4 py-2 text-gray-300">Thumbnail</th>
                <th className="px-4 py-2 text-gray-300">Caption</th>
                <th className="px-4 py-2 text-gray-300">Instagram URL</th>
                <th className="px-4 py-2 text-gray-300">Status</th>
                <th className="px-4 py-2 text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-t border-gray-700 hover:bg-gray-750">
                  <td className="px-4 py-2">
                    {template.thumbnail_url ? (
                      <img 
                        src={template.thumbnail_url} 
                        alt="Template thumbnail" 
                        className="w-24 h-auto rounded"
                      />
                    ) : (
                      <div className="w-24 h-16 bg-gray-700 rounded flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No thumbnail</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-300">
                    <div className="max-w-xs truncate">
                      {template.caption_text || (
                        <span className="text-gray-500 italic">No caption extracted</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <a 
                      href={template.instagram_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline truncate block max-w-xs"
                    >
                      {template.instagram_url}
                    </a>
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={template.status} />
                    {template.error_message && (
                      <div className="text-red-400 text-xs mt-1">{template.error_message}</div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => onTemplateSelect(template)}
                      disabled={template.status !== 'completed' || !template.cropped_video_url}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      Use Template
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

### 2.3. Integrate with Existing Template Uploader

*   **Modify `TemplateUploader.tsx`:**
    *   Add new props to accept initial values:

```tsx
interface TemplateUploaderProps {
  initialVideoUrl?: string;
  initialExplanation?: string;
  unprocessedTemplateId?: string;
  onTemplateUploaded?: () => void;
}

export function TemplateUploader({
  initialVideoUrl,
  initialExplanation,
  unprocessedTemplateId,
  onTemplateUploaded
}: TemplateUploaderProps) {
  // Existing state
  const [templateName, setTemplateName] = useState('')
  const [templateExplanation, setTemplateExplanation] = useState(initialExplanation || '')
  const [uploaderName, setUploaderName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(initialVideoUrl || '')
  // ... other existing state

  // Effect to handle props changes
  useEffect(() => {
    if (initialExplanation) {
      setTemplateExplanation(initialExplanation)
    }
    if (initialVideoUrl) {
      setPreview(initialVideoUrl)
    }
  }, [initialExplanation, initialVideoUrl])

  // Modify handleSubmit to also delete from unprocessed_templates if needed
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Existing upload logic...
      
      // After successful upload to meme_templates, delete from unprocessed_templates if applicable
      if (unprocessedTemplateId) {
        const { error: deleteError } = await supabase
          .from('unprocessed_templates')
          .delete()
          .eq('id', unprocessedTemplateId)

        if (deleteError) {
          console.error('Error deleting unprocessed template:', deleteError)
          // Note: We don't throw here as the main operation succeeded
        } else {
          console.log(`Deleted unprocessed template with ID: ${unprocessedTemplateId}`)
        }
      }

      // Reset form and call callback if provided
      setFile(null)
      setPreview('')
      setTemplateName('')
      setTemplateExplanation('')
      setPastedImages([])
      toast.success('Template uploaded successfully!')
      
      if (onTemplateUploaded) {
        onTemplateUploaded()
      }

    } catch (err) {
      // Existing error handling...
    } finally {
      setLoading(false)
    }
  }

  // ... rest of component (no changes)
}
```

### 2.4. Integration in Page Component

*   **Create or Modify Page Component:**
    *   Add state to track the selected template and refresh trigger.
    *   Implement handlers for template selection and updates.

```tsx
'use client'

import { useState } from 'react'
import { TemplateUploader } from '@/app/components/TemplateUploader'
import { ReelScraperForm } from '@/app/components/ReelScraperForm'
import { UnprocessedTemplatesTable } from '@/app/components/UnprocessedTemplatesTable'

export default function TemplatesPage() {
  // State for selected template from unprocessed table
  const [selectedTemplate, setSelectedTemplate] = useState<{
    id: string;
    video_url: string;
    caption: string;
  } | null>(null)
  
  // Refresh counter to trigger table refresh
  const [refreshCounter, setRefreshCounter] = useState(0)
  
  // Handler for template selection from the table
  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate({
      id: template.id,
      video_url: template.cropped_video_url,
      caption: template.caption_text || '',
    })
    
    // Scroll to the top (to the TemplateUploader)
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }
  
  // Handler for processing completion or template upload completion
  const handleRefreshNeeded = () => {
    setRefreshCounter(prev => prev + 1)
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8 text-white">Meme Template Management</h1>
      
      {/* Template Uploader */}
      <TemplateUploader 
        initialVideoUrl={selectedTemplate?.video_url}
        initialExplanation={selectedTemplate?.caption}
        unprocessedTemplateId={selectedTemplate?.id}
        onTemplateUploaded={() => {
          setSelectedTemplate(null)
          handleRefreshNeeded()
        }}
      />
      
      {/* Instagram Reel Scraper Form */}
      <ReelScraperForm 
        onProcessingComplete={handleRefreshNeeded} 
      />
      
      {/* Unprocessed Templates Table */}
      <UnprocessedTemplatesTable 
        onTemplateSelect={handleTemplateSelect}
        refreshTrigger={refreshCounter}
      />
    </div>
  )
}
```

## 3. Testing Checklist

*   [ ] **`ReelScraperForm` Component:**
    *   [ ] Does the form correctly display with a textarea for URLs and a submit button?
    *   [ ] Does it properly validate input (empty input, malformed URLs)?
    *   [ ] Does it show a loading state while processing?
    *   [ ] Does it handle errors from the API and display them to the user?
    *   [ ] Does it clear the textarea upon successful submission?
    *   [ ] Does it correctly trigger the `onProcessingComplete` callback?

*   [ ] **`UnprocessedTemplatesTable` Component:**
    *   [ ] Does the table load and display data from the `unprocessed_templates` table?
    *   [ ] Does it handle loading states correctly?
    *   [ ] Does it display template information in a readable format?
    *   [ ] Do the status badges show with the correct colors?
    *   [ ] Does the "Use Template" button correctly propagate the selected template?
    *   [ ] Does the manual refresh button fetch updated data?
    *   [ ] Does the table automatically refresh when `refreshTrigger` changes?

*   [ ] **Modified `TemplateUploader` Component:**
    *   [ ] Does it correctly display initial video URL and explanation when provided?
    *   [ ] After successful upload, does it correctly delete the record from `unprocessed_templates`?
    *   [ ] Does it call the `onTemplateUploaded` callback after successful submission?

*   [ ] **Page Integration:**
    *   [ ] Are all components displayed in the correct order?
    *   [ ] Does selecting a template from the table update the TemplateUploader?
    *   [ ] Does the page scroll to the top when a template is selected?
    *   [ ] After form submission in either component, does the table refresh?

*   [ ] **UI/UX:**
    *   [ ] Is the UI consistent with the rest of the application?
    *   [ ] Are loading states, error messages, and success notifications clear and informative?
    *   [ ] Is the form accessible (labels, focus states, keyboard navigation)?
    *   [ ] Does the table display well on different screen sizes? 