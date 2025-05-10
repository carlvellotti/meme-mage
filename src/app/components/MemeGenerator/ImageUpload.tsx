import React from 'react';
import { MemeTemplate } from '@/lib/supabase/types';
import { BackgroundImage } from '@/lib/types/meme';

interface ImageUploadProps {
  selectedTemplate: MemeTemplate | null; 
  isGreenscreenMode: boolean;
  previewVideoRef: React.RefObject<HTMLVideoElement>;
  selectedBackground: BackgroundImage | null;
  onClearBackground: () => void; // For when user clicks 'x' on selected background
  onOpenImagePicker: () => void;
  // We will pass attribution JSX as a slot/prop later if needed
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  selectedTemplate,
  isGreenscreenMode,
  previewVideoRef,
  selectedBackground,
  onClearBackground,
  onOpenImagePicker,
}) => {
  if (!selectedTemplate) return null; // Should not render if no template is selected

  return (
    <div className="flex gap-4">
      {isGreenscreenMode ? (
        // Greenscreen layout - two tall columns
        <>
          <div className="w-[200px] flex-shrink-0">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Video</h3>
            <video
              ref={previewVideoRef}
              src={selectedTemplate.video_url}
              className="w-full aspect-[9/16] object-cover rounded"
              controls
            />
          </div>

          <div className="w-[200px] flex-shrink-0">
            <h3 className="text-sm font-medium mb-2 text-white">Background</h3> {/* Changed text-gray-300 to text-white for consistency */}
            {selectedBackground ? (
              <div className="relative aspect-[9/16] rounded-lg overflow-hidden border border-gray-600"> {/* Added border for better definition */}
                <img 
                  src={selectedBackground.url} 
                  alt={selectedBackground.name}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={onClearBackground} // Use passed prop
                  className="absolute top-2 right-2 p-1 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-75"
                  aria-label="Clear background"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button 
                onClick={onOpenImagePicker} // Use passed prop
                className="w-full aspect-[9/16] flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-lg hover:bg-gray-700 transition-all group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-900 opacity-50" />
                <div className="relative flex flex-col items-center">
                  <div className="p-2 rounded-full bg-blue-900 mb-3 group-hover:bg-blue-800 transition-colors">
                    <svg 
                      className="w-5 h-5 text-blue-400" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-300">Choose background</p>
                  <p className="text-xs text-gray-500 mt-1">Add an image for your greenscreen</p>
                </div>
              </button>
            )}
          </div>
        </>
      ) : (
        // Non-greenscreen layout - single wide video
        <div className="w-full"> {/* Ensure it takes full width available in its column */}
          <h3 className="text-sm font-medium text-gray-300 mb-2">Video</h3>
          <video
            ref={previewVideoRef}
            src={selectedTemplate.video_url}
            className="w-full aspect-video object-cover rounded"
            controls
          />
        </div>
      )}
    </div>
  );
};

export default ImageUpload; 