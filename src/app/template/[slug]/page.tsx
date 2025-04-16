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

  // Handler to update the template state when instructions are saved
  const handleInstructionsSaved = (updatedData: Partial<MemeTemplate>) => {
    setTemplate(prevTemplate => {
      if (!prevTemplate) return null; // Should not happen if editing
      console.log('Updating parent template state with saved instructions...');
      return { ...prevTemplate, ...updatedData };
    });
  };

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
          <h1 className="text-3xl font-bold text-white">Loading Template...</h1>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-white">Error</h1>
            <button 
              onClick={handleBack}
              className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors border border-gray-700"
            >
              Back to Template Library
            </button>
          </div>
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-white">Template Not Found</h1>
            <button 
              onClick={handleBack}
              className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors border border-gray-700"
            >
              Back to Template Library
            </button>
          </div>
          <p className="text-gray-300">The template you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">
            {template.name}
          </h1>
          <button 
            onClick={handleBack}
            className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors border border-gray-700"
          >
            Back to Templates
          </button>
        </div>
        
        {template && selectedCaption && generatedOptions ? (
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
        ) : (
          <TemplateSpecificGenerator 
            template={template} 
            onBack={handleBack}
            onSelectTemplate={handleCreateFromTemplate}
            isGreenscreenMode={isGreenscreenMode}
            onInstructionsSaved={handleInstructionsSaved}
          />
        )}
      </div>
    </div>
  );
} 