'use client';

import { useState, useEffect } from 'react';
import { MemeTemplate } from '@/lib/supabase/types';
import Link from 'next/link';
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
  const router = useRouter();

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

  const handleCardClick = (template: MemeTemplate) => {
    router.push(`/template/${nameToSlug(template.name)}`);
  };

  if (isLoading) return <div>Loading templates...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {templates.map((template) => (
        <div
          key={template.id}
          className="border rounded-lg p-4 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
          onClick={() => handleCardClick(template)}
        >
          <h3 className="font-medium text-lg mb-3">{template.name}</h3>
          <div className="relative">
            <video
              src={template.video_url}
              className="w-full aspect-video object-cover rounded mb-2"
              controls
              onClick={(e) => e.stopPropagation()} // Allow video controls to work without navigating
            />
          </div>
        </div>
      ))}
    </div>
  );
} 