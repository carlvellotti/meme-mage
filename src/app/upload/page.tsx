'use client';

import { TemplateUploader } from '@/app/components/TemplateUploader'
import { ReelScraperForm } from '@/app/components/ReelScraperForm'

export default function UploadPage() {
  const handleRefreshNeeded = () => {
    console.log("Refresh needed - placeholder");
  };

  return (
    <div className="py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-white">Meme Template Management</h1>
        <p className="text-gray-300 mb-8">
          Upload a new meme template or process templates directly from Instagram Reels.
        </p>
        
        <TemplateUploader />
        
        <ReelScraperForm onProcessingComplete={handleRefreshNeeded} />
        
        {/* UnprocessedTemplatesTable will be added here later */}
      </div>
    </div>
  );
} 