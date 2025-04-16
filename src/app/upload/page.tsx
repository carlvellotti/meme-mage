'use client';

import { useState } from 'react';
import { TemplateUploader } from '@/app/components/TemplateUploader'
import { ReelScraperForm } from '@/app/components/ReelScraperForm'
import { UnprocessedTemplatesTable, UnprocessedTemplate } from '@/app/components/UnprocessedTemplatesTable'

export default function UploadPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<UnprocessedTemplate | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const handleRefreshNeeded = () => {
    console.log("Refresh needed - triggering table refresh");
    setRefreshCounter(prev => prev + 1);
  };

  const handleTemplateSelect = (template: UnprocessedTemplate) => {
    console.log("Template selected:", template);
    setSelectedTemplate(template);
  };

  return (
    <div className="py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-white">Meme Template Management</h1>
        <p className="text-gray-300 mb-8">
          Upload a new meme template or process templates directly from Instagram Reels.
        </p>
        
        <TemplateUploader 
          initialVideoUrl={selectedTemplate?.cropped_video_url ?? undefined}
          initialExplanation={selectedTemplate?.caption_text ?? undefined}
          unprocessedTemplateId={selectedTemplate?.id ?? undefined}
          initialSourceUrl={selectedTemplate?.instagram_url ?? undefined}
          onTemplateUploaded={() => {
            console.log('Template uploaded, clearing selection and refreshing table...');
            setSelectedTemplate(null);
            handleRefreshNeeded();
          }}
        />
        
        <ReelScraperForm onProcessingComplete={handleRefreshNeeded} />
        
        <UnprocessedTemplatesTable 
          onTemplateSelect={handleTemplateSelect} 
          refreshTrigger={refreshCounter} 
        />
      </div>
    </div>
  );
} 