> **DEPRECATION NOTE:** The components and workflow described in this document (`UnprocessedTemplatesTable`, selecting a template to finalize in `TemplateUploader`, and the associated DELETE API) have been **REPLACED** by the new AI-assisted template creation and review workflow implemented as part of the Gemini 2.5 Flash integration (see `src/docs/gemini 2.5 flash integration/`). Specifically, scraped templates are now directly analyzed by AI, inserted into the main `meme_templates` table with `reviewed=false`, and managed via the `UnreviewedTemplatesTable` component. This document is kept for historical reference only.

# Reels Scraper Integration: Chunk 3 - Frontend Components (Completed)

## 1. Goals (Achieved)

*   Develop a user interface component (`ReelScraperForm.tsx`) for inputting Instagram Reel URLs.
*   Create a table component (`UnprocessedTemplatesTable.tsx`) to display *completed* templates retrieved from the database, including pagination and video preview modal.
*   Implement communication between `ReelScraperForm` and the `/api/scrape-reels` endpoint (modified to wait for completion).
*   Enable selection of a completed template from `UnprocessedTemplatesTable` and propagate its data (`cropped_video_url`, `caption_text`, `id`, `instagram_url`) to the existing `TemplateUploader` component.
*   Modify `TemplateUploader` to:
    *   Accept initial data from the selected template.
    *   Save the `original_source_url`.
    *   Call the `/api/unprocessed-templates/[id]` DELETE endpoint after successfully saving a template originating from the unprocessed list.

## 2. Final Implementation Code

### 2.1. `ReelScraperForm.tsx` Component

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'

interface ReelScraperFormProps {
  onProcessingComplete?: () => void; // Callback when API responds (after script finishes)
}

export function ReelScraperForm({ onProcessingComplete }: ReelScraperFormProps) {
  const [urlsText, setUrlsText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const loadingToastId = toast.loading('Processing Reels...'); // Show loading toast

    try {
      // Parse URLs
      const urls = urlsText
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      if (urls.length === 0) {
        throw new Error('Please enter at least one Instagram Reel URL')
      }

      // Call the API endpoint (waits for completion)
      const response = await fetch('/api/scrape-reels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls }),
      })

      const responseData = await response.json(); // Always expect JSON now

      if (!response.ok) {
        throw new Error(responseData.error || responseData.details || `Failed to process Reels (Status: ${response.status})`)
      }

      // Success
      toast.success(responseData.message || `Successfully processed ${urls.length} URLs`, { id: loadingToastId })
      setUrlsText('') // Clear the textarea
      
      // Notify parent component
      if (onProcessingComplete) {
        onProcessingComplete()
      }
    } catch (err) {
      console.error('Error submitting URLs:', err)
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      toast.error(errorMessage, { id: loadingToastId }) // Update toast on error
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
            placeholder="https://www.instagram.com/reel/example1/\nhttps://www.instagram.com/reel/example2/"
            disabled={loading}
            required
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
```

### 2.2. `UnprocessedTemplatesTable.tsx` Component

```tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'

export interface UnprocessedTemplate {
  id: string
  instagram_url: string
  caption_text: string | null
  cropped_video_url: string | null
  thumbnail_url: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed' // Still needed for type safety
  error_message: string | null
  created_at: string
}

interface UnprocessedTemplatesTableProps {
  onTemplateSelect: (template: UnprocessedTemplate) => void;
  refreshTrigger?: number; 
}

const PAGE_LIMIT = 10; // Number of items to fetch per page

export function UnprocessedTemplatesTable({ 
  onTemplateSelect,
  refreshTrigger = 0
}: UnprocessedTemplatesTableProps) {
  const [templates, setTemplates] = useState<UnprocessedTemplate[]>([])
  const [loading, setLoading] = useState(true) // For initial load / refresh
  const [isLoadingMore, setIsLoadingMore] = useState(false); // For loading more items
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0); // Keep track of how many items loaded
  const [hasMore, setHasMore] = useState(true); // Assume more exist initially
  const [isModalOpen, setIsModalOpen] = useState(false); // State for modal visibility
  const [modalVideoUrl, setModalVideoUrl] = useState<string | null>(null); // State for modal video URL

  // Fetch completed templates from Supabase with pagination
  const fetchTemplates = async (loadMore = false) => {
    const currentOffset = loadMore ? offset : 0; 
    
    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      setLoading(true);
      setOffset(0); 
      setHasMore(true); 
    }
    setError(null)
    
    try {
      const { data, error: fetchError } = await supabase
        .from('unprocessed_templates')
        .select('*') 
        .eq('status', 'completed') // Filter for completed status only
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + PAGE_LIMIT - 1) 
      
      if (fetchError) throw fetchError

      const fetchedTemplates = data || [];

      if (loadMore) {
        setTemplates(prev => [...prev, ...fetchedTemplates]);
      } else {
        setTemplates(fetchedTemplates);
      }

      setOffset(currentOffset + fetchedTemplates.length);

      if (fetchedTemplates.length < PAGE_LIMIT) {
        setHasMore(false);
      }
      
    } catch (err) {
      console.error('Error fetching templates:', err)
      const message = err instanceof Error ? err.message : 'Failed to load templates'
      setError(message)
      if (!loadMore) toast.error(message);
    } finally {
      if (loadMore) {
        setIsLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }

  // Fetch templates on component mount and when refreshTrigger changes
  useEffect(() => {
    fetchTemplates(false); // Initial fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]); 

  // Handle manual refresh (resets pagination)
  const handleRefresh = () => {
    fetchTemplates(false); // Fetch first page again
    toast.success('Templates refreshed')
  }

  // Handle Load More click
  const handleLoadMore = () => {
    fetchTemplates(true); // Fetch next page
  }

  // Open modal handler
  const handleThumbnailClick = (videoUrl: string | null) => {
    if (videoUrl) {
      setModalVideoUrl(videoUrl);
      setIsModalOpen(true);
    }
  };

  // Close modal handler
  const closeModal = () => {
    setIsModalOpen(false);
    setModalVideoUrl(null);
  };

  return (
    <div className="space-y-4 bg-gray-800 p-6 rounded-lg border border-gray-700 mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Ready Templates</h2>
        <button
          onClick={handleRefresh}
          disabled={loading || isLoadingMore}
          className="px-4 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-wait transition-colors text-sm"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      
      {error && (
        <div className="text-red-400 text-sm p-3 bg-red-900/30 rounded border border-red-700">Error: {error}</div>
      )}
      
      <div className="overflow-x-auto relative">
        {loading && templates.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            {/* Loading spinner */}
            <svg className="animate-spin h-8 w-8 mx-auto mb-2 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <p>Loading templates...</p>
          </div>
        ) : !loading && templates.length === 0 && !error ? (
          <div className="py-8 text-center text-gray-400">
            <p>No processed templates ready.</p>
            <p className="text-sm mt-2">Use the form above to process Instagram Reels.</p>
          </div>
        ) : templates.length > 0 ? (
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="bg-gray-700 text-left text-gray-300">
                <th className="px-4 py-2 font-medium">Preview</th>
                <th className="px-4 py-2 font-medium">Caption</th>
                <th className="px-4 py-2 font-medium">Instagram URL</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-gray-750">
                  <td className="px-4 py-2 align-top">
                    {template.thumbnail_url ? (
                      <img 
                        src={template.thumbnail_url} 
                        alt="Click to preview video" 
                        className="w-24 h-auto rounded object-cover border border-gray-600 cursor-pointer hover:opacity-80 transition-opacity"
                        onError={(e) => (e.currentTarget.style.display = 'none')} 
                        onClick={() => handleThumbnailClick(template.cropped_video_url)}
                      />
                    ) : (
                      <div className="w-24 h-16 bg-gray-700 rounded flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No preview</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 align-top text-gray-300">
                      <div className="max-w-xs whitespace-normal break-words">
                        {template.caption_text || (<span className="text-gray-500 italic">No caption</span>)}
                      </div>
                  </td>
                  <td className="px-4 py-2 align-top">
                      <a 
                        href={template.instagram_url} 
                        target="_blank" rel="noopener noreferrer"
                        className="text-blue-400 hover:underline truncate block max-w-xs"
                        title={template.instagram_url}
                      >
                        {template.instagram_url}
                      </a>
                  </td>
                  <td className="px-4 py-2 align-top">
                    <button
                      onClick={() => onTemplateSelect(template)}
                      disabled={!template.cropped_video_url}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      Turn into template
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      {/* Load More Button */} 
      {!loading && hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="px-5 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-wait transition-colors text-sm font-medium"
          >
            {isLoadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {/* Video Modal */}
      {isModalOpen && modalVideoUrl && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity duration-300"
          onClick={closeModal} 
        >
          <div 
            className="bg-gray-900 p-4 rounded-lg max-w-3xl w-full mx-4 relative shadow-xl"
            onClick={(e) => e.stopPropagation()} 
          >
            <button 
              onClick={closeModal}
              className="absolute top-2 right-2 text-gray-400 hover:text-white text-2xl leading-none"
              aria-label="Close video preview"
            >
              &times;
            </button>
            <video 
              src={modalVideoUrl} 
              controls 
              autoPlay
              className="w-full max-h-[80vh] rounded"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}
    </div>
  )
}
```

### 2.3. Modified `TemplateUploader.tsx` Component

```tsx
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'

// Define the UnprocessedTemplate type (simplified for props)
interface UnprocessedTemplateInfo {
  id?: string;
  cropped_video_url?: string | null;
  caption_text?: string | null;
  instagram_url?: string | null; 
}

interface TemplateUploaderProps {
  initialVideoUrl?: string;      
  initialExplanation?: string;   
  unprocessedTemplateId?: string;
  initialSourceUrl?: string; // Added prop
  onTemplateUploaded?: () => void; 
}

export function TemplateUploader({ 
  initialVideoUrl,
  initialExplanation,
  unprocessedTemplateId,
  initialSourceUrl, // Destructure prop
  onTemplateUploaded
}: TemplateUploaderProps) {
  const [templateName, setTemplateName] = useState('')
  const [templateExplanation, setTemplateExplanation] = useState('')
  const [uploaderName, setUploaderName] = useState('') // Preserved across uploads now
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isGreenscreen, setIsGreenscreen] = useState(false)
  const [pastedImages, setPastedImages] = useState<string[]>([])
  const [isEnhancing, setIsEnhancing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Effect to handle initial values from props
  useEffect(() => {
    // Only update explanation if the prop changes and is different from current state
    if (initialExplanation && initialExplanation !== templateExplanation) {
      setTemplateExplanation(initialExplanation)
    }
    // Reset if prop becomes undefined (selection cleared)
    if (initialExplanation === undefined) {
       setTemplateExplanation('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialExplanation])

  useEffect(() => {
    // Only update preview if the prop changes and is different
     if (initialVideoUrl && initialVideoUrl !== preview) {
      setPreview(initialVideoUrl) 
      setFile(null) // Clear any selected file
    }
     // Reset if prop becomes undefined
    if (initialVideoUrl === undefined) {
        setPreview('')
        setFile(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVideoUrl])

  // Auto-resize textarea when content changes
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight + 2}px`;
    }
  }, [templateExplanation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const loadingToastId = toast.loading('Uploading template...');

    let storageUrl = '';

    try {
      // 1. Handle file upload OR use initialVideoUrl
      if (file) {
        console.log('Uploading new file...');
        const filename = `${Date.now()}-${file.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('meme-templates')
          .upload(filename, file)
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('meme-templates').getPublicUrl(uploadData.path)
        storageUrl = publicUrl;
        console.log('File uploaded, URL:', storageUrl);
      } else if (initialVideoUrl) {
        console.log('Using initial video URL:', initialVideoUrl);
        storageUrl = initialVideoUrl; 
      } else {
        throw new Error('No video file selected or provided')
      }

      if (!storageUrl) {
        throw new Error('Could not determine video URL');
      }

      // 2. Generate embedding
      const textForEmbedding = `${templateName}. ${templateExplanation}`.trim()
      if (!textForEmbedding) {
        throw new Error('Template name and explanation cannot be empty for embedding generation.');
      }
      console.log('Generating embedding...');
      const embeddingResponse = await fetch('/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textForEmbedding })
      });
      if (!embeddingResponse.ok) {
        const errorText = await embeddingResponse.text();
        throw new Error(`Failed to generate embedding: ${errorText || response.status}`);
      }
      const { embedding } = await embeddingResponse.json();
      if (!embedding || embedding.length === 0) {
        throw new Error('Received invalid embedding from API');
      }

      // 3. Create database entry
      console.log('Saving template to database...');
      const { error: dbError, data: dbData } = await supabase
        .from('meme_templates')
        .insert({
          name: templateName,
          instructions: templateExplanation,
          video_url: storageUrl,
          embedding,
          is_greenscreen: isGreenscreen,
          uploader_name: uploaderName,
          original_source_url: initialSourceUrl // Add the source URL
        })
        .select()
        .single();
      if (dbError) throw dbError;
      console.log('Template saved successfully:', dbData);

      // 4. Delete from unprocessed_templates if applicable
      if (unprocessedTemplateId) {
        console.log(`Attempting to delete unprocessed template ID: ${unprocessedTemplateId}`);
        try {
          const deleteResponse = await fetch(`/api/unprocessed-templates/${unprocessedTemplateId}`, {
            method: 'DELETE',
          });
          if (!deleteResponse.ok) {
            const deleteErrorText = await deleteResponse.text();
            console.error(`Failed to delete unprocessed template ${unprocessedTemplateId}. Status: ${deleteResponse.status}. Error: ${deleteErrorText}`);
            toast.error(`Template saved, but failed to remove from unprocessed list (ID: ${unprocessedTemplateId}).`, { id: loadingToastId }); // Update toast
            // Don't re-throw, main operation succeeded
          } else {
            console.log(`Successfully deleted unprocessed template ID: ${unprocessedTemplateId}`);
            toast.success('Template uploaded and original removed!', { id: loadingToastId }); // Update toast
          }
        } catch (deleteFetchError) {
           console.error(`Error making DELETE request for unprocessed template ${unprocessedTemplateId}:`, deleteFetchError);
           toast.error(`Template saved, but encountered an error removing from unprocessed list (ID: ${unprocessedTemplateId}).`, { id: loadingToastId }); // Update toast
        }
      } else {
         toast.success('Template uploaded successfully!', { id: loadingToastId }); // Update toast if no deletion needed
      }

      // 5. Reset form and notify parent
      setFile(null)
      setPreview('')
      setTemplateName('')
      setTemplateExplanation('')
      setPastedImages([])
      setIsGreenscreen(false) 
      // Uploader name is intentionally NOT reset
      
      if (onTemplateUploaded) {
        onTemplateUploaded()
      }

    } catch (err) {
      console.error('Error details:', err)
      const message = err instanceof Error ? err.message : 'An error occurred while uploading'
      setError(message)
      toast.error(`Upload failed: ${message}`, { id: loadingToastId }) // Update toast on error
    } finally {
      setLoading(false)
    }
  }

  // ... (rest of the component: handlePaste, enhanceDescription, drag handlers, JSX)
  
  // Example of the submit button modification in JSX:
  /*
  <button
    type="submit"
    disabled={loading || (!file && !preview) || !templateName.trim() || !templateExplanation.trim()} // Allows submission if preview exists
    // ... other attributes
  >
    {loading ? 'Uploading...' : 'Upload Template'}
  </button>
  */
}

// Include the rest of the TemplateUploader component's JSX here...
// (handlePaste, enhanceDescription, drag handlers, return statement with form fields etc.)
```

### 2.4. Page Integration (`src/app/upload/page.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { TemplateUploader } from '@/app/components/TemplateUploader'
import { ReelScraperForm } from '@/app/components/ReelScraperForm'
import { UnprocessedTemplatesTable, UnprocessedTemplate } from '@/app/components/UnprocessedTemplatesTable' // Import type

export default function UploadPage() {
  // State holds the full template object now
  const [selectedTemplate, setSelectedTemplate] = useState<UnprocessedTemplate | null>(null); 
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Triggered by ReelScraperForm after API responds
  const handleRefreshNeeded = () => {
    console.log("Refresh needed - triggering table refresh");
    setRefreshCounter(prev => prev + 1); 
  };

  // Triggered by UnprocessedTemplatesTable when a row's button is clicked
  const handleTemplateSelect = (template: UnprocessedTemplate) => {
    console.log("Template selected:", template);
    setSelectedTemplate(template); // Store the whole selected template object
    // Scroll to top to show the uploader populated
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-white">Meme Template Management</h1>
        <p className="text-gray-300 mb-8">
          Upload a new meme template or process templates directly from Instagram Reels.
        </p>
        
        {/* Pass selectedTemplate data and callback to TemplateUploader */}
        <TemplateUploader 
          // Pass relevant fields, use ?? undefined to ensure prop is absent if null/undefined
          initialVideoUrl={selectedTemplate?.cropped_video_url ?? undefined}
          initialExplanation={selectedTemplate?.caption_text ?? undefined}
          unprocessedTemplateId={selectedTemplate?.id ?? undefined}
          initialSourceUrl={selectedTemplate?.instagram_url ?? undefined} 
          onTemplateUploaded={() => {
            console.log('Template uploaded callback: Clearing selection and refreshing table...');
            setSelectedTemplate(null); // Clear the selection
            handleRefreshNeeded();    // Trigger table refresh
          }}
        />
        
        <ReelScraperForm onProcessingComplete={handleRefreshNeeded} /> 
        
        <UnprocessedTemplatesTable 
          onTemplateSelect={handleTemplateSelect} 
          refreshTrigger={refreshCounter} 
        />
      </div>
    </div>
  );
} 
```

## 3. Updated Testing Checklist

*   [ ] **`ReelScraperForm` Component:**
    *   [x] Does the form correctly display with a textarea for URLs and a submit button?
    *   [x] Does it properly validate input (empty input)?
    *   [x] Does it show a loading state/toast while the backend processes?
    *   [x] Does it handle errors from the API (now waiting for completion) and display them?
    *   [x] Does it clear the textarea upon successful submission?
    *   [x] Does it correctly trigger the `onProcessingComplete` callback *after* the backend finishes?

*   [ ] **`UnprocessedTemplatesTable` Component:**
    *   [x] Does the table load and display *only completed* templates?
    *   [x] Does it handle initial loading states correctly?
    *   [x] Does it display template preview, caption, and Instagram URL?
    *   [x] Does the "Turn into template" button correctly propagate the selected template data?
    *   [x] Does the manual refresh button fetch updated data (first page)?
    *   [x] Does the table automatically refresh when `refreshTrigger` changes?
    *   [x] Does clicking the thumbnail open a video preview modal?
    *   [x] Does the modal close correctly?
    *   [x] Does the "Load More" button appear correctly?
    *   [x] Does clicking "Load More" fetch and append the next page of results?
    *   [x] Does "Load More" hide when no more results are available?

*   [ ] **Modified `TemplateUploader` Component:**
    *   [x] Does it correctly display initial video URL (preview) and explanation when provided via props?
    *   [x] Does the submit button become enabled when required fields (name) are filled *after* selecting a template?
    *   [x] Does `handleSubmit` use the `initialVideoUrl` if no new file is uploaded?
    *   [x] After successful upload, does it correctly delete the record from `unprocessed_templates` using the API?
    *   [x] Does it save the `original_source_url` to the `meme_templates` table?
    *   [x] Does it call the `onTemplateUploaded` callback after successful submission?
    *   [x] Does it **not** clear the `uploaderName` field on reset?

*   [ ] **Page Integration:**
    *   [x] Are all components displayed in the correct order?
    *   [x] Does selecting a template from the table update the `TemplateUploader` fields (video, explanation)?
    *   [x] Does the page scroll to the top when a template is selected?
    *   [x] After form submission in `ReelScraperForm`, does the table refresh (via callback)?
    *   [x] After successful submission in `TemplateUploader`, does the uploader reset (except name) and the table refresh (via callback)?

*   [ ] **Backend API (`/api/scrape-reels/route.ts`):**
    *   [x] Does the API route now wait for the Python script to complete?
    *   [x] Does it return a 200 OK on success?
    *   [x] Does it return a 500 error on script failure?

*   [ ] **Backend Python Script (`process_reels.py`, `db_manager.py`):**
    *   [x] Does it allow reprocessing of duplicate URLs (assuming DB constraint removed)?
    *   [x] Does it correctly handle inserts without checking for existing URLs? 