'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MemeTemplate } from '@/lib/supabase/types';
import { nameToSlug } from '@/lib/utils/slugUtils';
import { useRouter } from 'next/navigation';

interface Props {
  onSelectTemplate?: (template: MemeTemplate) => void;
  onCreateFromTemplate?: (template: MemeTemplate, caption: string, allOptions: any) => void;
  isGreenscreenMode?: boolean;
  onToggleMode?: () => void;
}

const TEMPLATES_PER_PAGE = 12;

export default function TemplateBrowser({ 
  onSelectTemplate, 
  onCreateFromTemplate,
  isGreenscreenMode = false,
  onToggleMode
}: Props) {
  // State variables
  const [loadedTemplates, setLoadedTemplates] = useState<MemeTemplate[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Refs and hooks
  const router = useRouter();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  // Fetch templates function (modified for pagination)
  const fetchTemplatesPage = useCallback(async (pageNum: number, isRefresh = false) => {
    if (pageNum === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/templates?page=${pageNum}&limit=${TEMPLATES_PER_PAGE}&t=${new Date().getTime()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch templates');
      }
      const data: { templates: MemeTemplate[], totalCount: number } = await response.json();

      setLoadedTemplates(prev => isRefresh ? data.templates : [...prev, ...data.templates]);
      setTotalCount(data.totalCount);
      setPage(pageNum);
      setHasMore( (isRefresh ? data.templates.length : loadedTemplates.length + data.templates.length) < data.totalCount );

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      if (isRefresh) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplatesPage(1, true);
  }, [fetchTemplatesPage]);

  const refreshTemplates = useCallback(async () => {
    setIsRefreshing(true);
    setLoadedTemplates([]);
    setPage(1);
    setHasMore(true);
    setTotalCount(null);
    if (observerRef.current && loadingRef.current) {
        try {
            observerRef.current.unobserve(loadingRef.current);
        } catch(e) { /* ignore */ }
    }
    await fetchTemplatesPage(1, true);
  }, []);

  useEffect(() => {
    if (hasMore && !isLoading && !isLoadingMore && loadingRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            console.log('Intersection detected, fetching next page...', page + 1);
            fetchTemplatesPage(page + 1);
          }
        },
        { threshold: 0.1 }
      );

      observerRef.current.observe(loadingRef.current);
    }

    return () => {
      if (observerRef.current && loadingRef.current) {
        try {
            observerRef.current.unobserve(loadingRef.current);
        } catch (e) {
            console.warn("Error unobserving loadingRef:", e)
        }
      }
    };
  }, [hasMore, isLoading, isLoadingMore, page]);

  const handleCardClick = (template: MemeTemplate) => {
    router.push(`/template/${nameToSlug(template.name)}`);
  };

  const handleMouseEnter = (templateId: string) => {
    setHoveredTemplate(templateId);
  };

  const handleMouseLeave = () => {
    setHoveredTemplate(null);
  };

  if (isLoading && page === 1) return <div className="text-gray-300">Loading templates...</div>;
  if (error && loadedTemplates.length === 0) return <div className="text-red-400">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-white">Templates {totalCount !== null ? `(${totalCount})` : ''}</h2>
        <button 
          onClick={refreshTemplates}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center space-x-1 disabled:opacity-50"
          disabled={isRefreshing || isLoading}
        >
          <svg 
            className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            ></path>
          </svg>
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>
      
      {error && loadedTemplates.length > 0 && (
          <div className="text-red-400 text-center p-2 bg-red-900/20 rounded">Error loading more templates: {error}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {loadedTemplates.map((template) => {
          const isHovered = hoveredTemplate === template.id;
          
          return (
            <div
              key={template.id}
              className={`border border-gray-700 rounded-lg p-4 cursor-pointer transition-all duration-300 ${
                isHovered 
                  ? 'border-blue-400 shadow-lg z-10 bg-gray-700' 
                  : 'hover:border-blue-400 hover:shadow-md'
              }`}
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest('video')) {
                  handleCardClick(template);
                }
              }}
              onMouseEnter={() => handleMouseEnter(template.id)}
              onMouseLeave={handleMouseLeave}
            >
              <h3 
                className={`font-medium text-white text-lg mb-3 ${isHovered ? '' : 'truncate'}`}
                title={template.name}
              >
                {template.name}
              </h3>

              <div 
                className="relative overflow-hidden rounded-md bg-gray-800"
                style={{
                  maxHeight: isHovered ? '1000px' : '180px',
                  transition: 'max-height 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                  willChange: 'max-height'
                }}
              >
                <video
                  src={template.video_url}
                  poster={template.poster_url || ''}
                  className={`rounded w-full ${
                    isHovered ? 'object-contain' : 'object-cover h-full'
                  }`}
                  style={{
                    aspectRatio: isHovered ? 'auto' : '16/9',
                    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  controls
                  onClick={(e) => e.stopPropagation()} 
                  preload="metadata"
                />
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div ref={loadingRef} className="col-span-full flex justify-center py-4">
          <div className="text-gray-400">
            {isLoadingMore ? 'Loading more templates...' : 'Scroll to load more'} 
          </div>
        </div>
      )}

      {!isLoading && loadedTemplates.length === 0 && !error && (
        <div className="text-center py-8 text-gray-300">
          <p>No templates found.</p>
        </div>
      )}
    </div>
  );
} 