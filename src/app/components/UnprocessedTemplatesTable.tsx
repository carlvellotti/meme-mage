'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'

// Define the UnprocessedTemplate type
export interface UnprocessedTemplate {
  id: string
  instagram_url: string
  caption_text: string | null
  cropped_video_url: string | null
  thumbnail_url: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message: string | null
  created_at: string
}

interface UnprocessedTemplatesTableProps {
  onTemplateSelect: (template: UnprocessedTemplate) => void;
  refreshTrigger?: number; // Optional prop to trigger refresh when value changes
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalVideoUrl, setModalVideoUrl] = useState<string | null>(null);

  // Fetch templates from Supabase with pagination
  const fetchTemplates = async (loadMore = false) => {
    const currentOffset = loadMore ? offset : 0; // Start from 0 if not loading more
    
    // Set appropriate loading state
    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      setLoading(true);
      setOffset(0); // Reset offset on refresh/initial load
      setHasMore(true); // Assume more exist on refresh
    }
    setError(null)
    
    try {
      const { data, error: fetchError } = await supabase
        .from('unprocessed_templates')
        .select('*', { count: 'exact' }) // Request count for accurate pagination (optional but good)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + PAGE_LIMIT - 1) // Fetch range
      
      if (fetchError) throw fetchError

      const fetchedTemplates = data || [];

      if (loadMore) {
        setTemplates(prev => [...prev, ...fetchedTemplates]);
      } else {
        setTemplates(fetchedTemplates);
      }

      // Update offset
      setOffset(currentOffset + fetchedTemplates.length);

      // Check if there are more items
      if (fetchedTemplates.length < PAGE_LIMIT) {
        setHasMore(false);
      }
      
    } catch (err) {
      console.error('Error fetching templates:', err)
      const message = err instanceof Error ? err.message : 'Failed to load templates'
      setError(message)
      // Don't show toast on load more error potentially?
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
    fetchTemplates(false); // Initial fetch (not loadMore)
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

  // Render status badge with appropriate color
  const StatusBadge = ({ status }: { status: string }) => {
    let bgColor = 'bg-gray-500' // Default
    let textColor = 'text-white'
    
    switch (status) {
      case 'completed':
        bgColor = 'bg-green-600'
        break
      case 'processing':
        bgColor = 'bg-blue-600'
        break
      case 'pending':
        bgColor = 'bg-yellow-500'
        textColor = 'text-gray-900'
        break
      case 'failed':
        bgColor = 'bg-red-600'
        break
    }
    
    return (
      <span className={`px-2 py-1 text-xs rounded font-medium ${bgColor} ${textColor}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-4 bg-gray-800 p-6 rounded-lg border border-gray-700 mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Ready Templates</h2>
        <button
          onClick={handleRefresh}
          disabled={loading || isLoadingMore} // Disable if initial loading or loading more
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
            <svg className="animate-spin h-8 w-8 mx-auto mb-2 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
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
                      {template.caption_text || (
                        <span className="text-gray-500 italic">No caption</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 align-top">
                    <a 
                      href={template.instagram_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
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