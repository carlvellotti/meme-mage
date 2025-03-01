'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MemeTemplate } from '@/lib/supabase/types';
import TemplateSpecificGenerator from '@/app/components/TemplateSpecificGenerator';
import MemeGenerator from '@/app/components/MemeGenerator';

interface SelectedMeme {
  templates: {
    template: MemeTemplate;
    captions: string[];
  }[];
  selectedTemplate?: MemeTemplate;
  selectedCaption?: string;
}

export default function TemplatePage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [template, setTemplate] = useState<MemeTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGreenscreenMode, setIsGreenscreenMode] = useState(false);
  const [selectedCaption, setSelectedCaption] = useState<string | null>(null);
  const [generatedOptions, setGeneratedOptions] = useState<SelectedMeme | null>(null);

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/templates/by-slug/${params.slug}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Template not found');
          }
          throw new Error('Failed to fetch template');
        }
        
        const data = await response.json();
        setTemplate(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load template');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplate();
  }, [params.slug]);

  const handleBack = () => {
    router.push('/template-library');
  };

  const handleToggleMode = () => {
    setIsGreenscreenMode(!isGreenscreenMode);
  };

  const handleCreateFromTemplate = (template: MemeTemplate, caption: string, allOptions: SelectedMeme) => {
    setSelectedCaption(caption);
    setGeneratedOptions(allOptions);
  };

  // Custom handler for MemeGenerator to handle the back action
  const handleMemeGeneratorBack = () => {
    setSelectedCaption(null);
  };

  if (isLoading) {
    return (
      <div className="py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Loading Template...</h1>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Error</h1>
          <p className="text-red-500">{error}</p>
          <button 
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Back to Template Library
          </button>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Template Not Found</h1>
          <p>The template you're looking for doesn't exist.</p>
          <button 
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Back to Template Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">
          {template.name}
        </h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          {template && selectedCaption && generatedOptions ? (
            <div>
              <button 
                onClick={handleBack}
                className="mb-4 px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Back to Templates
              </button>
              <div className="mt-4">
                <MemeGenerator 
                  isGreenscreenMode={isGreenscreenMode} 
                  onToggleMode={handleToggleMode}
                  initialTemplate={template}
                  initialCaption={selectedCaption}
                  initialOptions={generatedOptions}
                  onBack={handleMemeGeneratorBack}
                />
              </div>
            </div>
          ) : (
            <TemplateSpecificGenerator 
              template={template} 
              onBack={handleBack}
              onSelectTemplate={handleCreateFromTemplate}
              isGreenscreenMode={isGreenscreenMode}
            />
          )}
        </div>
      </div>
    </div>
  );
} 