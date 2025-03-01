'use client';

import { useState } from 'react';
import TemplateBrowser from './TemplateBrowser';
import { MemeTemplate } from '@/lib/supabase/types';
import MemeGenerator from './MemeGenerator';

interface SelectedMeme {
  templates: {
    template: MemeTemplate;
    captions: string[];
  }[];
  selectedTemplate?: MemeTemplate;
  selectedCaption?: string;
}

export default function MemeDatabase() {
  const [selectedTemplate, setSelectedTemplate] = useState<MemeTemplate | null>(null);
  const [isGreenscreenMode, setIsGreenscreenMode] = useState(false);
  const [selectedCaption, setSelectedCaption] = useState<string | null>(null);
  const [generatedOptions, setGeneratedOptions] = useState<SelectedMeme | null>(null);
  
  const handleSelectTemplate = (template: MemeTemplate) => {
    setSelectedTemplate(template);
  };
  
  const handleBack = () => {
    setSelectedTemplate(null);
    setSelectedCaption(null);
    setGeneratedOptions(null);
  };
  
  const handleToggleMode = () => {
    setIsGreenscreenMode(!isGreenscreenMode);
  };

  const handleCreateFromTemplate = (template: MemeTemplate, caption: string, allOptions: SelectedMeme) => {
    setSelectedTemplate(template);
    setSelectedCaption(caption);
    setGeneratedOptions(allOptions);
  };

  if (selectedTemplate && selectedCaption) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
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
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <TemplateBrowser 
        onSelectTemplate={handleSelectTemplate}
        onCreateFromTemplate={handleCreateFromTemplate}
        isGreenscreenMode={isGreenscreenMode}
        onToggleMode={handleToggleMode}
      />
    </div>
  );
} 