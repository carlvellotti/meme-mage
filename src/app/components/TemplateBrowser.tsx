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
      {visibleTemplates.map((template) => {
        const isHovered = hoveredTemplate === template.id;
        
        return (
          <div
            key={template.id}
            className={`border rounded-lg p-4 cursor-pointer transition-all duration-300 ${
              isHovered 
                ? 'border-blue-500 shadow-lg z-10 bg-white' 
                : 'hover:border-blue-500 hover:shadow-md'
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
              className={`font-medium text-lg mb-3 ${isHovered ? '' : 'truncate'}`}
              title={template.name}
            >
              {template.name}
            </h3>
            
            {/* Video container */}
            <div 
              className="relative overflow-hidden rounded transition-all duration-500"
              style={{
                maxHeight: isHovered ? '1000px' : '180px', // Expand downward with animation
                transitionProperty: 'max-height',
              }}
            >
              <video
                src={template.video_url}
                className={`rounded w-full ${
                  isHovered ? 'object-contain' : 'object-cover h-full'
                }`}
                style={{
                  aspectRatio: isHovered ? 'auto' : '16/9',
                  transition: 'all 0.5s ease',
                }}
                controls
                onClick={(e) => e.stopPropagation()} // Allow video controls to work without navigating
              />
            </div>
          </div>
        );
      })}
      
      {/* Loading indicator for infinite scroll */}
      {visibleTemplates.length < templates.length && (
        <div ref={loadingRef} className="col-span-full flex justify-center py-4">
          <div className="animate-pulse text-gray-400">Loading more templates...</div>
        </div>
      )}
    </div>
  );
} 