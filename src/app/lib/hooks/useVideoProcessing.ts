import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { createMemePreview } from '@/lib/utils/previewGenerator';
import { createMemeVideo } from '@/lib/utils/videoProcessor';
import { TextSettings } from '@/lib/types/meme'; 
import { Label, CommonLabelSettings } from '@/app/lib/hooks/useLabels';

// Copied from MemeGenerator.tsx - consider moving to a shared types file e.g. @/lib/types/meme.ts
export interface WatermarkSettings {
  text: string;
  horizontalPosition: number; 
  verticalPosition: number;   
  size: number;
  font: string;
  color: 'white' | 'black';
  strokeWeight: number;
  opacity: number; 
  backgroundColor: 'black' | 'white' | 'transparent';
  backgroundOpacity: number; 
}

interface VideoProcessingBaseParams {
  videoUrl: string;
  caption: string;
  backgroundUrl?: string;
  backgroundVideoUrl?: string;
  isGreenscreenMode: boolean;
  textSettings: TextSettings;
  labels: Label[];
  labelSettings: CommonLabelSettings;
  isCropped: boolean;
  isWatermarkEnabled: boolean;
  watermarkSettings: WatermarkSettings;
  videoVerticalOffset?: number;
}

export interface GeneratePreviewParams extends VideoProcessingBaseParams {}
export interface ProcessAndDownloadParams extends VideoProcessingBaseParams {
  fileName: string; 
}

export const useVideoProcessing = () => {
  const [isProcessing, setIsProcessing] = useState(false); // For download/export operations
  const [currentPreview, setCurrentPreview] = useState<HTMLCanvasElement | null>(null);

  const generatePreview = useCallback(async (params: GeneratePreviewParams) => {
    if (!params.videoUrl) {
      // console.warn('generatePreview called without videoUrl');
      setCurrentPreview(null);
      return;
    }
    try {
      const canvas = await createMemePreview(
        params.videoUrl,
        params.caption,
        params.backgroundUrl,
        params.isGreenscreenMode,
        params.textSettings,
        params.labels,
        params.labelSettings,
        params.isCropped,
        params.isWatermarkEnabled,
        params.watermarkSettings,
        params.videoVerticalOffset,
        params.backgroundVideoUrl
      );
      setCurrentPreview(canvas);
    } catch (error) {
      console.error('Error generating preview:', error);
      toast.error('Failed to update preview');
      setCurrentPreview(null); 
    }
  }, []);

  const processAndDownloadMeme = useCallback(async (params: ProcessAndDownloadParams) => {
    if (!params.videoUrl || !params.caption) {
        toast.error("Cannot download: Missing template or caption.");
        return;
    }
    setIsProcessing(true);
    const toastId = toast.loading("Brewing your meme... this might take a moment!");
    try {
      const videoBlob = await createMemeVideo(
        params.videoUrl,
        params.caption,
        params.backgroundUrl,
        params.isGreenscreenMode,
        params.textSettings,
        params.labels,
        params.labelSettings,
        params.isCropped,
        params.isWatermarkEnabled,
        params.watermarkSettings,
        params.videoVerticalOffset,
        params.backgroundVideoUrl
      );

      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = params.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Meme downloaded!", { id: toastId });
    } catch (error) {
      console.error('Error generating or downloading meme:', error);
      toast.error("Oops! Couldn't generate the meme. Please try again.", { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    isProcessing,
    currentPreview,
    generatePreview,
    processAndDownloadMeme,
  };
}; 