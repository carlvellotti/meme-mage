'use client';

import { useCallback, useEffect, useState, DragEvent, useRef } from 'react';
import debounce from 'lodash/debounce';
import { toast } from 'react-hot-toast';

interface UnsplashImage {
  id: string;
  urls: {
    regular: string;
    small: string;
  };
  user: {
    name: string;
    username: string;
    links: {
      html: string;
    };
    social: {
      instagram_username: string | null;
      twitter_username: string | null;
      portfolio_url: string | null;
    };
  };
  links: {
    download_location: string;
  };
}

interface ImagePickerProps {
  onSelect: (image: { id: string; name: string; url: string; attribution?: { photographerName: string; photographerUrl: string; photoUrl: string; username: string; instagram_username: string | null } }) => void;
  onClose: () => void;
  isOpen: boolean;
}

type Tab = 'unsplash' | 'upload' | 'link';

export default function ImagePicker({ onSelect, onClose, isOpen }: ImagePickerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('unsplash');
  const [search, setSearch] = useState('');
  const [images, setImages] = useState<UnsplashImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [imageUrl, setImageUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const searchUnsplash = useCallback(
    debounce(async (query: string, pageNum: number) => {
      if (!query.trim()) {
        setImages([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/unsplash/search?query=${encodeURIComponent(query)}&page=${pageNum}`
        );
        const data = await response.json();
        
        if (pageNum === 1) {
          setImages(data.results);
        } else {
          setImages(prev => [...prev, ...data.results]);
        }
      } catch (error) {
        console.error('Error searching Unsplash:', error);
        toast.error('Failed to load images');
      } finally {
        setIsLoading(false);
      }
    }, 500),
    []
  );

  useEffect(() => {
    if (search.trim()) {
      searchUnsplash(search, page);
    }
  }, [search, page]);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setImages([]);
      setPage(1);
      setImageUrl('');
      setActiveTab('unsplash');
    }
  }, [isOpen]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error('File size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      onSelect({
        id: 'uploaded-' + Date.now(),
        name: file.name,
        url
      });
      onClose();
    };
    reader.readAsDataURL(file);
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim()) return;

    try {
      new URL(imageUrl);
      onSelect({
        id: 'link-' + Date.now(),
        name: 'Linked Image',
        url: imageUrl
      });
      onClose();
    } catch {
      toast.error('Please enter a valid URL');
    }
  };

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items[0].kind === 'file') {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsDragging(false);
  }, []);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      onSelect({
        id: 'uploaded-' + Date.now(),
        name: file.name,
        url
      });
      onClose();
    };
    reader.readAsDataURL(file);
  };

  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div 
        className="absolute inset-0 bg-black/60" 
        style={{ position: 'fixed' }}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div 
          ref={modalRef}
          className="bg-gray-800 rounded-lg w-full max-w-xl flex flex-col relative z-10 border border-gray-700"
          style={{ height: '600px' }}
        >
          <div className="border-b border-gray-700">
            <div className="flex">
              {[
                { id: 'unsplash', label: 'Unsplash' },
                { id: 'upload', label: 'Upload' },
                { id: 'link', label: 'Link' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 focus:outline-none ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'unsplash' && (
              <div className="h-full flex flex-col">
                <div className="p-3 border-b border-gray-700">
                  <div className="relative">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Search Unsplash..."
                      className="w-full p-2 pl-9 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-gray-700 text-white"
                    />
                    <svg 
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                  <div className="grid grid-cols-2 gap-3">
                    {images.map((image) => (
                      <button
                        key={image.id}
                        onClick={async () => {
                          // Track download
                          try {
                            await fetch(`/api/unsplash/download?downloadLocation=${encodeURIComponent(image.links.download_location)}`, {
                              method: 'POST',
                            });
                          } catch (error) {
                            console.error('Failed to track download:', error);
                          }
                          
                          onSelect({
                            id: image.id,
                            name: `Unsplash photo by ${image.user.name}`,
                            url: image.urls.regular,
                            attribution: {
                              photographerName: image.user.name,
                              photographerUrl: `${image.user.links.html}?utm_source=meme_mage&utm_medium=referral&utm_campaign=api-credit`,
                              photoUrl: `https://unsplash.com/photos/${image.id}?utm_source=meme_mage&utm_medium=referral`,
                              username: image.user.username,
                              instagram_username: image.user.social?.instagram_username || null
                            }
                          });
                          onClose();
                        }}
                        className="group relative aspect-[9/16] overflow-hidden rounded-lg border border-gray-700 hover:border-blue-400 transition-colors"
                      >
                        <img 
                          src={image.urls.small} 
                          alt={`Photo by ${image.user.name}`} 
                          className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                        />
                      </button>
                    ))}
                  </div>

                  {images.length > 0 && (
                    <div className="mt-3 text-center">
                      <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={isLoading}
                        className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isLoading ? 'Loading...' : 'Load More'}
                      </button>
                    </div>
                  )}

                  {isLoading && images.length === 0 && (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
                      <p className="mt-2 text-gray-400">Searching images...</p>
                    </div>
                  )}

                  {!isLoading && images.length === 0 && search && (
                    <div className="text-center py-12 text-gray-400">
                      No images found for "{search}"
                    </div>
                  )}

                  {!isLoading && images.length === 0 && !search && (
                    <div className="text-center py-12 text-gray-400">
                      Start typing to search for images
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'upload' && (
              <div className="p-4 h-full flex flex-col">
                <div 
                  className={`flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center ${
                    isDragging 
                      ? 'border-blue-500 bg-blue-900 bg-opacity-10' 
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />

                  <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                    <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm text-gray-300 font-medium">Click to upload or drag and drop</span>
                    <span className="text-xs text-gray-400 mt-1">PNG, JPG, GIF up to 10MB</span>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'link' && (
              <div className="p-4">
                <form onSubmit={handleLinkSubmit} className="w-full">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Image URL
                    </label>
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="w-full p-2 border border-gray-700 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!imageUrl.trim()}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                  >
                    Use This Image
                  </button>
                </form>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-700 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 mr-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 