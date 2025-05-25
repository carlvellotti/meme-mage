'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
// Import react-image-crop
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

// Assuming MemeTemplate type exists and is imported where used
interface MemeTemplate {
  id: string;
  name: string;
  video_url: string;
  // Add other relevant fields
}

interface VideoPreviewCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: MemeTemplate | null;
  onCropComplete: (templateId: string, updatedUrl?: string) => void; // Callback after successful crop
}

// Helper to center the initial crop
function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number = 1 // Default to free aspect ratio
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        // Start with a 90% selection in the center
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

const VideoPreviewCropModal: React.FC<VideoPreviewCropModalProps> = ({ 
  isOpen, 
  onClose, 
  template, 
  onCropComplete 
}) => {

  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null); // For the captured frame
  const [crop, setCrop] = useState<Crop>(); // State for react-image-crop
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false); // For API call loading state
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null); // URL of the video to display
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null); // Ref for the image element in the cropper
  const hasAutoPlayedRef = useRef<boolean>(false); // Ref to track initial autoplay

  // Reset state when modal closes or template changes
  useEffect(() => {
    if (isOpen && template) {
      // Initialize/reset video URL when modal opens or template changes
      setCurrentVideoUrl(template.video_url);
      hasAutoPlayedRef.current = false; // Reset autoplay flag when template/modal opens
    } else if (!isOpen) {
      // Reset everything when modal closes
      setIsCropping(false);
      setImageSrc(null);
      setCrop(undefined);
      setVideoDimensions(null);
      setIsProcessing(false);
      setCurrentVideoUrl(null); // Clear URL when closed
    }
  }, [isOpen, template]);

  // Handler to get video dimensions once loaded
  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDimensions({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
      });
      console.log('Video dimensions loaded:', videoRef.current.videoWidth, videoRef.current.videoHeight);

      // Attempt to autoplay once after metadata loads
      if (!hasAutoPlayedRef.current) {
        console.log('Attempting initial autoplay...');
        videoRef.current.play().then(() => {
            console.log('Autoplay started successfully.');
            hasAutoPlayedRef.current = true;
        }).catch(error => {
            console.warn('Autoplay was prevented:', error); 
            // Set flag even if prevented, so we don't retry
            hasAutoPlayedRef.current = true; 
        });
      }
    }
  };

  // Function to capture the current video frame to the canvas
  const captureFrame = () => {
    if (videoRef.current && canvasRef.current && videoDimensions) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = videoDimensions.width;
      canvas.height = videoDimensions.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Pause video before drawing to ensure consistent frame
        video.pause();
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png'); // Or 'image/jpeg'
        setImageSrc(dataUrl);
        console.log('Frame captured');
        return true;
      }
    }
    console.error('Failed to capture frame: refs or dimensions missing.');
    return false;
  };

  // --- Updated Start Crop Handler ---
  const handleStartCrop = () => {
    if (!videoRef.current || !videoDimensions) { 
      toast.error("Video data not loaded yet.");
      return;
    }
    console.log('Start Crop clicked');
    if (captureFrame()) {
      setIsCropping(true);
    } else {
      toast.error("Failed to capture video frame.");
    }
  };

  // Handler for when the image in the cropper loads
  // Set the initial crop box here when entering crop mode
  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
     const imageElement = e.currentTarget;
     console.log("Preview image loaded, natural dims:", imageElement.naturalWidth, imageElement.naturalHeight);
     
     // If we are in cropping mode and the crop hasn't been set yet (or needs reset),
     // set the initial crop to cover the full image using percentage units.
     if (isCropping) { // Check if we are in cropping mode
       // Ensure dimensions are valid before setting (though not strictly necessary for %)
       if (imageElement.naturalWidth > 0 && imageElement.naturalHeight > 0) {
           console.log("onImageLoad: Setting initial crop to 100% using percentage units.");
           setCrop({
              unit: '%',
              x: 0,
              y: 0,
              width: 100,
              height: 100,
          });
       } else {
           console.warn("onImageLoad: Image loaded but natural dimensions are zero (still attempting % crop).");
           // Still attempt to set a 100% crop even if natural dims are 0, as % might work
           setCrop({
              unit: '%',
              x: 0,
              y: 0,
              width: 100,
              height: 100,
          });
       }
     }
  }

  const handleCancelCrop = () => {
    setIsCropping(false);
    setImageSrc(null);
    setCrop(undefined);
    // Optionally resume video playback
    // videoRef.current?.play();
  };

  const handleSaveCrop = async () => {
    console.log('Save Crop clicked');
    // Ensure template, crop object, and imgRef are available.
    // videoDimensions will be checked before being used for scaling.
    if (!template || !crop || !imgRef.current ) {
        toast.error("Cannot save crop - missing necessary data or crop selection.");
        return;
    }
    // Validate raw crop values from state - these are pixels from react-image-crop relative to displayed image.
    if (crop.width === undefined || crop.height === undefined || crop.width < 0 || crop.height < 0 ) {
        toast.error("Invalid crop selection. Please select an area.");
        return;
    }
    // Further check: if width or height is 0, it's not a valid crop unless it's the initial un-interacted state.
    // However, user must interact to enable save, so 0 width/height here is an issue.
    if (crop.width === 0 || crop.height === 0) {
        toast.error("Crop selection width or height is zero. Please select a valid area.");
        return;
    }

    setIsProcessing(true);

    // Ensure videoDimensions (natural video size) and imgRef.current (for displayed image size) are available.
    if (!videoDimensions || !imgRef.current.width || !imgRef.current.height) {
        toast.error("Cannot save crop - video or image dimensions are not available for scaling.");
        setIsProcessing(false);
        return;
    }

    console.log('Crop state from react-image-crop (pixels relative to displayed image):', JSON.parse(JSON.stringify(crop)));
    console.log('Natural video dimensions:', videoDimensions);
    console.log('Displayed image dimensions (imgRef.current):', { w: imgRef.current.width, h: imgRef.current.height });

    // Calculate scaling factors.
    const scaleX = videoDimensions.width / imgRef.current.width;
    const scaleY = videoDimensions.height / imgRef.current.height;
    console.log('Scaling factors:', { scaleX, scaleY });

    // Convert crop coordinates from displayed image pixels to natural video pixels.
    const naturalPixelX = crop.x * scaleX;
    const naturalPixelY = crop.y * scaleY;
    const naturalPixelWidth = crop.width * scaleX;
    const naturalPixelHeight = crop.height * scaleY;

    const finalCrop = {
      x: Math.round(naturalPixelX),
      y: Math.round(naturalPixelY),
      width: Math.round(naturalPixelWidth),
      height: Math.round(naturalPixelHeight),
    };

    console.log('Final crop payload for API (pixels relative to natural video):', finalCrop);

    // Sanity check the final natural pixel coordinates.
    if (finalCrop.width <= 0 || finalCrop.height <= 0) {
        toast.error("Calculated crop width or height for API is zero or negative.");
        setIsProcessing(false);
        return;
    }
    // Check against natural video dimensions.
    if (finalCrop.x < -1 || finalCrop.y < -1 || // Allow for small rounding errors, e.g. -0.5 rounds to 0
        finalCrop.x + finalCrop.width > videoDimensions.width + 1.5 || 
        finalCrop.y + finalCrop.height > videoDimensions.height + 1.5) {
      console.error("Final crop coordinates for API are invalid or out of bounds: ", finalCrop, "against natural video dims:", videoDimensions);
      toast.error("Crop selection is invalid or out of bounds after scaling to natural video size.");
      setIsProcessing(false);
      return;
    }

    try {
      // --- API Call ---
      console.log('Calling API with template ID:', template.id, 'and crop:', finalCrop);
      const response = await fetch(`/api/templates/${template.id}/crop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalCrop),
      });

      if (!response.ok) {
        let errorMsg = `API error (${response.status})`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.error || JSON.stringify(errorData);
        } catch (e) { /* Ignore parsing error */ }
        throw new Error(errorMsg);
      }

      const result = await response.json();
      console.log("API Success Response:", result);
      toast.success('Video cropped successfully!');
      
      // Pass the updated URL back to the parent
      onCropComplete(template.id, result.updatedVideoUrl);
      
      // --- Update state instead of closing ---
      if (result.updatedVideoUrl) {
        setCurrentVideoUrl(result.updatedVideoUrl);
      }
      setIsCropping(false);
      setImageSrc(null);
      setCrop(undefined);
      // Do NOT close the modal: onClose(); 

    } catch (error: any) {
      console.error("Crop API call failed:", error);
      toast.error(`Crop failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Click outside modal to close
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
          onClose();
      }
  };


  if (!isOpen || !template) return null;

  // Render logic
  return (
    <>
      {/* Overlay with explicit top:0 and margin/padding overrides */}
      <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-50 m-0"
          style={{ top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={handleOverlayClick}
      />
      
      {/* Modal content centered using flex in a separate layer */}
      <div className="fixed inset-0 z-50 flex items-center justify-center" 
           style={{ top: 0, left: 0, right: 0, bottom: 0 }}>
        {/* Invisible Canvas for frame capture */} 
        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

        <div 
          className="bg-gray-800 p-4 sm:p-6 rounded-lg max-w-4xl w-full mx-auto relative shadow-xl border border-gray-700 flex flex-col max-h-[95vh]"
          onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
        >
          {/* Header */} 
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h3 className="text-lg font-semibold text-white truncate pr-4">
              Preview: {template.name}
            </h3>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none disabled:opacity-50"
              aria-label="Close modal"
              disabled={isProcessing}
            >
              &times;
            </button>
          </div>

          {/* Content Area */} 
          <div className={`flex flex-col flex-grow ${isCropping ? '' : 'overflow-y-auto'} mb-4`}>
             {/* Show Video OR Cropping UI */} 
             {!isCropping ? (
               <>
                 {/* Render video element immediately */} 
                 {currentVideoUrl ? (
                   <video
                     ref={videoRef}
                     // Use the state variable for the source
                     src={currentVideoUrl}
                     onLoadedMetadata={handleVideoLoadedMetadata}
                     controls
                     preload="metadata" 
                     crossOrigin="anonymous" 
                     className="max-w-full max-h-[65vh] object-contain mx-auto block"
                     // Key update forces re-render if URL changes, ensuring metadata reloads etc.
                     key={currentVideoUrl} 
                   >
                     Your browser does not support the video tag.
                   </video>
                 ) : (
                   // Show error message if video doesn't load
                   <div className="w-full h-[65vh] flex items-center justify-center">
                     <p className="text-gray-400">
                       {template?.video_url ? 'Loading video...' : 'Missing video URL!'} 
                     </p>
                   </div>
                 )}
               </>
             ) : (
                // Container for cropping UI - Keep h-full
                <div className="flex items-center justify-center w-full">
                  {imageSrc && (
                    <ReactCrop
                      crop={crop}
                      onChange={(c, percentCrop) => setCrop(c)}
                      minWidth={10} 
                      minHeight={10}
                      // Apply constraints to ReactCrop component
                      className="max-w-full max-h-[70vh]" 
                    >
                      <img 
                        ref={imgRef}
                        src={imageSrc} 
                        alt="Video Frame" 
                        style={{ display: 'block' }} 
                        onLoad={onImageLoad}
                      />
                    </ReactCrop>
                  )}
                  {!imageSrc && <p className="text-white">Loading frame...</p>}
                </div>
             )}
          </div>

          {/* Footer with Buttons */} 
          <div className="mt-auto flex justify-end space-x-3 flex-shrink-0 pt-4 border-t border-gray-700">
            {!isCropping ? (
              <>
                <button
                  onClick={handleStartCrop}
                  disabled={!videoDimensions || isProcessing}
                  title={!videoDimensions ? "Wait for video to load" : "Crop this video"}
                  className="px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:opacity-50"
                >
                  Crop Video
                </button>
                <button
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm font-medium rounded-md text-gray-300 bg-gray-600 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-400 disabled:opacity-50"
                >
                  Close
                </button>
              </>
            ) : (
              <> { /* Buttons for Cropping Mode */}
                <button
                  onClick={handleCancelCrop}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm font-medium rounded-md text-gray-300 bg-gray-600 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-400 disabled:opacity-50"
                >
                  Cancel Crop
                </button>
                <button
                  onClick={handleSaveCrop}
                  // Disable if processing or if crop selection is invalid/zero size
                  disabled={isProcessing || !crop || !crop.width || !crop.height}
                  className="px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 disabled:opacity-50 disabled:cursor-wait"
                >
                  {isProcessing ? 'Saving...' : 'Save Crop'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default VideoPreviewCropModal; 