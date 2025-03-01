'use client';

import { useState, useEffect } from 'react';
import { MemeTemplate } from '@/lib/supabase/types';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<MemeTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  if (isLoading) return <div className="p-8">Loading templates...</div>;
  if (error) return <div className="p-8">Error: {error}</div>;

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Meme Templates</h1>
        <button 
          onClick={refreshTemplates}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Link
            key={template.id}
            href={`/templates/${template.id}`}
            className="border rounded-lg p-4 cursor-pointer hover:border-blue-500 relative"
          >
            <video
              src={template.video_url}
              className="w-full aspect-video object-cover rounded mb-2"
              controls
            />
            <h3 className="font-medium">{template.name}</h3>
          </Link>
        ))}
      </div>
    </div>
  );
} 