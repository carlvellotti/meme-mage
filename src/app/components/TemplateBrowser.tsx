'use client';

import { useState, useEffect, useRef } from 'react';
import { MemeTemplate } from '@/lib/supabase/types';
import { nameToSlug } from '@/lib/utils/slugUtils';
import { useRouter } from 'next/navigation';

interface Props {
  onSelectTemplate: (template: MemeTemplate) => void;
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
  const router = useRouter();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const TEMPLATES_PER_PAGE = 12;

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch('/api/templates');
        if (!response.ok) {
          throw new Error('Failed to fetch templates');
        }
        const data = await response.json();
        setTemplates(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load templates');
      } finally {
        setIsLoading(false);
      }
    };

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
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [visibleTemplates.length, templates.length]);

  const handleCardClick = (template: MemeTemplate) => {
    router.push(`/template/${nameToSlug(template.name)}`);
  };

  const handleMouseEnter = (templateId: string) => {
    setHoveredTemplate(templateId);
  };

  const handleMouseLeave = () => {
    setHoveredTemplate(null);
  };

  if (isLoading) return <div>Loading templates...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {visibleTemplates.map((template) => (
        <div
          key={template.id}
          className="border rounded-lg p-4 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
          onClick={() => handleCardClick(template)}
          onMouseEnter={() => handleMouseEnter(template.id)}
          onMouseLeave={handleMouseLeave}
        >
          {/* Title with truncation and tooltip */}
          <h3 
            className="font-medium text-lg mb-3 truncate" 
            title={template.name}
          >
            {template.name}
          </h3>
          
          {/* Video container with hover effect */}
          <div className="relative overflow-hidden rounded">
            {hoveredTemplate === template.id ? (
              // Full video on hover
              <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                <div className="relative max-w-3xl max-h-[80vh] w-full">
                  <button 
                    className="absolute top-4 right-4 bg-white rounded-full p-2 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHoveredTemplate(null);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <video
                    src={template.video_url}
                    className="max-w-full max-h-full object-contain mx-auto"
                    controls
                    autoPlay
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            ) : (
              // Thumbnail view
              <div className="aspect-video">
                <video
                  src={template.video_url}
                  className="w-full h-full object-cover rounded"
                  style={{ objectFit: 'cover' }}
                  controls
                  onClick={(e) => e.stopPropagation()} // Allow video controls to work without navigating
                />
              </div>
            )}
          </div>
        </div>
      ))}
      
      {/* Loading indicator for infinite scroll */}
      {visibleTemplates.length < templates.length && (
        <div ref={loadingRef} className="col-span-full flex justify-center py-4">
          <div className="animate-pulse text-gray-400">Loading more templates...</div>
        </div>
      )}
    </div>
  );
} 