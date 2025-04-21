'use client';

import { useState } from 'react';
import { TemplateUploader } from '@/app/components/TemplateUploader'
import { ReelScraperForm } from '@/app/components/ReelScraperForm'
import ReviewTemplatesTable from '@/app/components/ReviewTemplatesTable'

export default function UploadPage() {
  const [refreshCounter, setRefreshCounter] = useState(0);

  const handleRefreshNeeded = () => {
    console.log("Refresh needed - triggering table refresh");
    setRefreshCounter(prev => prev + 1);
  };

  return (
    <div className="py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-white">Meme Template Management</h1>
        <p className="text-gray-300 mb-8">
          Upload a new meme template manually, process new templates from Instagram Reels, or review AI-generated templates.
        </p>
        
        <div className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-gray-100">Upload New Template</h2>
          <TemplateUploader />
        </div>

        <div className="mb-12">
          <ReviewTemplatesTable 
            className="bg-gray-800 p-6 rounded-lg border border-gray-700" 
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