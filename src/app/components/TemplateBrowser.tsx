'use client';

import { useState, useEffect, useRef } from 'react';
import { MemeTemplate } from '@/lib/supabase/types';
import { nameToSlug } from '@/lib/utils/slugUtils';
import { useRouter } from 'next/navigation';

interface Props {
  onSelectTemplate?: (template: MemeTemplate) => void;
  onCreateFromTemplate?: (template: MemeTemplate, caption: string, allOptions: any) => void;
  isGreenscreenMode?: boolean;
  onToggleMode?: () => void;
}

export default function TemplateBrowser({ 
  onSelectTemplate, 
  onCreateFromTemplate,
  isGreenscreenMode = false,
  onToggleMode
}: Props) {
  const [templates, setTemplates] = useState<MemeTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleTemplates, setVisibleTemplates] = useState<MemeTemplate[]>([]);
  const [page, setPage] = useState(1);
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const TEMPLATES_PER_PAGE = 12;

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates?t=' + new Date().getTime());
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      const data = await response.json();
      setTemplates(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTemplates = async () => {
    setIsRefreshing(true);
    await fetchTemplates();
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Update visible templates when templates or page changes
  useEffect(() => {
    if (templates.length > 0) {
      setVisibleTemplates(templates.slice(0, page * TEMPLATES_PER_PAGE));
    }
  }, [templates, page]);

  // Set up intersection observer for infinite scrolling
  useEffect(() => {
    if (loadingRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && visibleTemplates.length < templates.length) {
            // Load more templates when the loading element is visible
            setPage((prevPage) => prevPage + 1);
          }
        },
        { threshold: 0.1 }
      );

      observerRef.current.observe(loadingRef.current);
    }

    return () => {
      if (observerRef.current && loadingRef.current) {
        observerRef.current.unobserve(loadingRef.current);
      }
    };
  }, [visibleTemplates, templates]);

  const handleCardClick = (template: MemeTemplate) => {
    router.push(`/template/${nameToSlug(template.name)}`);
  };

  const handleMouseEnter = (templateId: string) => {
    setHoveredTemplate(templateId);
  };

  const handleMouseLeave = () => {
    setHoveredTemplate(null);
  };

  if (isLoading) return <div className="text-gray-300">Loading templates...</div>;
  if (error) return <div className="text-red-400">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-white">Templates</h2>
        <button 
          onClick={refreshTemplates}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center space-x-1"
          disabled={isRefreshing}
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
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {visibleTemplates.map((template) => {
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
                // Only navigate if the click wasn't on the video
                if (!(e.target as HTMLElement).closest('video')) {
                  handleCardClick(template);
                }
              }}
              onMouseEnter={() => handleMouseEnter(template.id)}
              onMouseLeave={handleMouseLeave}
            >
              {/* Title - full when hovered, truncated otherwise */}
              <h3 
                className={`font-medium text-white text-lg mb-3 ${isHovered ? '' : 'truncate'}`}
                title={template.name}
              >
                {template.name}
              </h3>

              {/* Video container with improved transition */}
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
                  className={`rounded w-full ${
                    isHovered ? 'object-contain' : 'object-cover h-full'
                  }`}
                  style={{
                    aspectRatio: isHovered ? 'auto' : '16/9',
                    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  controls
                  onClick={(e) => e.stopPropagation()} // Allow video controls to work without navigating
                  preload="metadata"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Loading element for infinite scroll */}
      {visibleTemplates.length < templates.length && (
        <div ref={loadingRef} className="col-span-full flex justify-center py-4">
          <div className="text-gray-400">Loading more templates...</div>
        </div>
      )}

      {/* Empty state */}
      {templates.length === 0 && !isLoading && (
        <div className="text-center py-8 text-gray-300">
          <p>No templates found.</p>
        </div>
      )}
    </div>
  );
} 