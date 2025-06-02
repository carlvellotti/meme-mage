import React, { useState } from 'react';
import { BackgroundVideo } from '@/lib/types/meme';
import BackgroundVideoUpload from './BackgroundVideoUpload';

interface BackgroundVideoSelectorProps {
  selectedBackgroundVideo: BackgroundVideo | null;
  backgroundVideos: BackgroundVideo[];
  onSelect: (video: BackgroundVideo | null) => void;
  isLoading: boolean;
  disabled?: boolean;
  onRefreshVideos?: () => void;
}

const BackgroundVideoSelector: React.FC<BackgroundVideoSelectorProps> = ({
  selectedBackgroundVideo,
  backgroundVideos,
  onSelect,
  isLoading,
  disabled = false,
  onRefreshVideos
}) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleVideoUploaded = (newVideo: BackgroundVideo) => {
    // Refresh the video list to include the newly uploaded video
    if (onRefreshVideos) {
      onRefreshVideos();
    }
    
    // Optionally auto-select the newly uploaded video
    onSelect(newVideo);
  };

  return (
    <div className="space-y-2">
      <label htmlFor="backgroundVideo" className="block text-sm font-medium text-gray-300">
        Background Video (Optional)
      </label>
      
      {isLoading ? (
        <div className="text-sm text-gray-400">Loading background videos...</div>
      ) : (
        <>
          <select
            id="backgroundVideo"
            value={selectedBackgroundVideo?.id || ''}
            onChange={(e) => {
              const selectedId = e.target.value;
              if (selectedId === '') {
                onSelect(null);
              } else {
                const selectedVideo = backgroundVideos.find(v => v.id === selectedId);
                onSelect(selectedVideo || null);
              }
            }}
            disabled={disabled || isUploading}
            className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
          >
            <option value="">None (Black Background)</option>
            {backgroundVideos.map((video) => (
              <option key={video.id} value={video.id}>
                {video.name}
              </option>
            ))}
          </select>
          
          <BackgroundVideoUpload
            onVideoUploaded={handleVideoUploaded}
            isUploading={isUploading}
            onUploadingChange={setIsUploading}
          />
        </>
      )}
      
      {selectedBackgroundVideo && selectedBackgroundVideo.thumbnail_url && (
        <div className="mt-2">
          <img
            src={selectedBackgroundVideo.thumbnail_url}
            alt={`${selectedBackgroundVideo.name} preview`}
            className="w-20 h-12 object-cover rounded border border-gray-600"
          />
        </div>
      )}
    </div>
  );
};

export default BackgroundVideoSelector; 