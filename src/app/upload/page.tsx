'use client';

import { TemplateUploader } from '@/app/components/TemplateUploader'

export default function UploadPage() {
  return (
    <div className="py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-white">Upload Meme Template</h1>
        <p className="text-gray-300 mb-8">
          Add a new meme template to the database. Please include a clear explanation of how the template should be used.
        </p>
        <TemplateUploader />
      </div>
    </div>
  );
} 