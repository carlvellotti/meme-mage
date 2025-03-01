'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MemeTemplate } from '@/lib/supabase/types';
import TemplateSpecificGenerator from '@/app/components/TemplateSpecificGenerator';
import MemeGenerator from '@/app/components/MemeGenerator';
import { toast } from 'react-hot-toast';

interface SelectedMeme {
  templates: {
    template: MemeTemplate;
    captions: string[];
  }[];
  selectedTemplate?: MemeTemplate;
  selectedCaption?: string;
}

export default function TemplateEditorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [template, setTemplate] = useState<MemeTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMemeGenerator, setShowMemeGenerator] = useState(false);
  const [selectedCaption, setSelectedCaption] = useState<string>('');
  const [selectedMeme, setSelectedMeme] = useState<SelectedMeme | null>(null);
  const [isGreenscreenMode, setIsGreenscreenMode] = useState(false);

  useEffect(() => {
    const fetchTemplate = async () => {
      setIsLoading(true);
      try {
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/templates/${params.id}?t=${timestamp}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          next: { revalidate: 0 }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch template');
        }
        
        const data = await response.json();
        setTemplate(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load template');
        toast.error('Failed to load template');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplate();
  }, [params.id]);

  const handleBack = () => {
    router.push('/templates');
  };

  const handleSelectTemplate = (template: MemeTemplate, caption: string, allOptions: SelectedMeme) => {
    setSelectedCaption(caption);
    setSelectedMeme(allOptions);
    setShowMemeGenerator(true);
  };

  const handleMemeGeneratorBack = () => {
    setShowMemeGenerator(false);
  };

  const toggleGreenscreenMode = () => {
    setIsGreenscreenMode(!isGreenscreenMode);
  };

  if (isLoading) return <div className="p-8">Loading template...</div>;
  if (error) return <div className="p-8">Error: {error}</div>;
  if (!template) return <div className="p-8">Template not found</div>;

  if (showMemeGenerator && selectedMeme) {
    return (
      <div className="container mx-auto p-8">
        <MemeGenerator
          initialTemplate={template}
          initialCaption={selectedCaption}
          initialOptions={selectedMeme}
          onBack={handleMemeGeneratorBack}
          isGreenscreenMode={isGreenscreenMode}
          onToggleMode={toggleGreenscreenMode}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <TemplateSpecificGenerator
        template={template}
        onBack={handleBack}
        onSelectTemplate={handleSelectTemplate}
        isGreenscreenMode={isGreenscreenMode}
      />
      
      <div className="mt-6 flex justify-end">
        <button
          onClick={toggleGreenscreenMode}
          className={`px-4 py-2 rounded-md ${
            isGreenscreenMode ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800'
          }`}
        >
          {isGreenscreenMode ? 'Greenscreen Mode: ON' : 'Greenscreen Mode: OFF'}
        </button>
      </div>
    </div>
  );
} 