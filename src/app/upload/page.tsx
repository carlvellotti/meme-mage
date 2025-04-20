'use client';

import { useState } from 'react';
import { TemplateUploader } from '@/app/components/TemplateUploader'
import { ReelScraperForm } from '@/app/components/ReelScraperForm'
import { UnprocessedTemplatesTable, UnprocessedTemplate } from '@/app/components/UnprocessedTemplatesTable'
import UnreviewedTemplatesTable from '@/app/components/UnreviewedTemplatesTable'

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
        
        <div className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-gray-100">Upload or Finalize Template</h2>
          <TemplateUploader 
            initialVideoUrl={selectedTemplate?.cropped_video_url ?? undefined}
            initialExplanation={selectedTemplate?.caption_text ?? undefined}
            unprocessedTemplateId={selectedTemplate?.id ?? undefined}
            initialSourceUrl={(selectedTemplate as any)?.instagram_url ?? undefined}
            onTemplateUploaded={() => {
              console.log('Template uploaded, clearing selection and refreshing table...');
              setSelectedTemplate(null);
              handleRefreshNeeded();
            }}
          />
        </div>

        <div className="mb-12">
          <UnreviewedTemplatesTable className="bg-gray-800 p-6 rounded-lg border border-gray-700" />
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-gray-100">Scraped Reels (Pending Finalization)</h2>
          <UnprocessedTemplatesTable 
            onTemplateSelect={handleTemplateSelect} 
            refreshTrigger={refreshCounter} 
          />
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4 text-gray-100">Scrape New Instagram Reels</h2>
          <ReelScraperForm onProcessingComplete={handleRefreshNeeded} /> 
        </div>
      </div>
    </div>
  );
} 