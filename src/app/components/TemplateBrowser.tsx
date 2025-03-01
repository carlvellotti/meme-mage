'use client';

import { useState, useEffect } from 'react';
import { MemeTemplate } from '@/lib/supabase/types';
import TemplateSpecificGenerator from './TemplateSpecificGenerator';

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
  const [selectedTemplate, setSelectedTemplate] = useState<MemeTemplate | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/templates?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        next: { revalidate: 0 }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      const data = await response.json();
      console.log('Fetched templates:', data.length);
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTemplates = () => {
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    fetchTemplates();
  }, [refreshKey]);

  const handleCreateClick = (template: MemeTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTemplate(template);
  };

  const handleBack = () => {
    refreshTemplates();
    setSelectedTemplate(null);
  };

  if (selectedTemplate) {
    return (
      <TemplateSpecificGenerator 
        template={selectedTemplate} 
        onBack={handleBack}
        onSelectTemplate={onCreateFromTemplate || onSelectTemplate}
        isGreenscreenMode={isGreenscreenMode}
      />
    );
  }

  if (isLoading) return <div>Loading templates...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {templates.map((template) => (
        <div
          key={template.id}
          className="border rounded-lg p-4 cursor-pointer hover:border-blue-500 relative"
          onClick={() => onSelectTemplate(template)}
        >
          <button 
            className="absolute top-2 right-2 bg-blue-600 text-white px-3 py-1 rounded-md text-sm z-10"
            onClick={(e) => handleCreateClick(template, e)}
          >
            Create
          </button>
          <video
            src={template.video_url}
            className="w-full aspect-video object-cover rounded mb-2"
            controls
          />
          <h3 className="font-medium">{template.name}</h3>
        </div>
      ))}
    </div>
  );
} 