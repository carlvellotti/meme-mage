'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-hot-toast';
import { debounce } from '@/lib/utils/debounce';

// Local imports
import { MemeTemplate } from '@/lib/supabase/types';
import { BackgroundImage, TextSettings } from '@/lib/types/meme';
import { supabase } from '@/lib/supabase/client';
import { createMemeVideo } from '@/lib/utils/videoProcessor';
import { createMemePreview } from '@/lib/utils/previewGenerator';

// Components
import AIMemeSelector from './AIMemeSelector';
import ImagePicker from '@/app/components/ImagePicker';
import SpinningOrb from './SpinningOrb';
import BackgroundSVG from './BackgroundSVG';

// Import or define the SelectedMeme interface
interface SelectedMeme {
  templates: {
    template: MemeTemplate;
    captions: string[];
  }[];
}

interface TemplateData {
  template: MemeTemplate;
  captions: string[];
}

interface MemeGeneratorProps {
  isGreenscreenMode: boolean;
  onToggleMode: () => void;
  initialTemplate?: MemeTemplate;
  initialCaption?: string;
  initialOptions?: SelectedMeme;
  onBack?: () => void;
}

// Add this interface near the top with other interfaces
interface Label {
  id: string;
  text: string;
  horizontalPosition: number;
  verticalPosition: number;
  size: number;
  font: string;
}

// Add this interface near your other interfaces
interface UnsplashImage {
  id: string;
  urls: {
    regular: string;
    small: string;
  };
  user: {
    name: string;
    username: string;
    social?: {
      instagram_username: string | null;
      twitter_username: string | null;
      portfolio_url: string | null;
    };
  };
}

export default function MemeGenerator({ 
  isGreenscreenMode, 
  onToggleMode, 
  initialTemplate, 
  initialCaption, 
  initialOptions,
  onBack
}: MemeGeneratorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<MemeTemplate | null>(initialTemplate || null);
  const [caption, setCaption] = useState<string>(initialCaption || '');
  const [isDownloading, setIsDownloading] = useState(false);
  const [generatedOptions, setGeneratedOptions] = useState<SelectedMeme | null>(initialOptions || null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundImage | null>(null);
  const [backgrounds, setBackgrounds] = useState<BackgroundImage[]>([]);
  const [isLoadingBackgrounds, setIsLoadingBackgrounds] = useState(false);
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  const [textSettings, setTextSettings] = useState<TextSettings>({
    size: 78,
    font: 'Impact',
    verticalPosition: isGreenscreenMode ? 25 : 25,
    alignment: 'center',
    color: 'white',
    strokeWeight: 0.08,
  });
  const [labels, setLabels] = useState<Label[]>([]);
  const [backgroundSearch, setBackgroundSearch] = useState('');
  const [unsplashImages, setUnsplashImages] = useState<UnsplashImage[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [page, setPage] = useState(1);
  const [isUnsplashPickerOpen, setIsUnsplashPickerOpen] = useState(false);
  const [labelSettings, setLabelSettings] = useState<{
    font: string;
    size: number;
    color: 'white' | 'black';
    strokeWeight: number;
    backgroundColor: 'black' | 'white' | 'transparent';
    backgroundOpacity: number;
  }>({
    font: 'Impact',
    size: 78,
    color: 'white',
    strokeWeight: 0.08,
    backgroundColor: 'black',
    backgroundOpacity: 0.5,
  });
  const [isCropped, setIsCropped] = useState(false);

  // Add a ref to track if the position has been calculated for this template
  const hasCalculatedPositionRef = useRef<string | null>(null);

  // Add debug logging for attribution
  useEffect(() => {
    if (selectedBackground) {
      console.log('DEBUG - Selected Background:', {
        id: selectedBackground.id,
        name: selectedBackground.name,
        hasAttribution: !!selectedBackground.attribution,
        attributionKeys: selectedBackground.attribution ? Object.keys(selectedBackground.attribution) : []
      });
    }
  }, [selectedBackground]);

  useEffect(() => {
    async function loadBackgrounds() {
      setIsLoadingBackgrounds(true);
      try {
        const { data, error } = await supabase
          .from('backgrounds')
          .select('*')
          .eq('aspect_ratio', '9:16');
        
        if (error) throw error;
        if (data) setBackgrounds(data);
      } catch (error) {
        console.error('Error loading backgrounds:', error);
        toast.error('Failed to load backgrounds');
      } finally {
        setIsLoadingBackgrounds(false);
      }
    }

    if (isGreenscreenMode) {
      loadBackgrounds();
    }
  }, [isGreenscreenMode]);

  // Add effect to update preview when crop state changes
  useEffect(() => {
    if (selectedTemplate && caption) {
      // Small delay to ensure state updates are complete
      setTimeout(() => {
        updatePreview();
      }, 50);
    }
  }, [isCropped]);

  // Existing effect for preview updates
  useEffect(() => {
    if (selectedTemplate && (caption || labels.length > 0)) {
      updatePreview();
    }
  }, [selectedTemplate, caption, selectedBackground, isGreenscreenMode, textSettings, labels, labelSettings]);

  // Initialize preview when component mounts with initial values
  useEffect(() => {
    if (initialTemplate && initialCaption) {
      updatePreview();
    }
  }, []);

  // Add useEffect to calculate caption position on initial template load
  useEffect(() => {
    if (!isGreenscreenMode && selectedTemplate && hasCalculatedPositionRef.current !== selectedTemplate.id) {
      calculateCaptionPosition();
    }
  }, [selectedTemplate, isGreenscreenMode]);

  // Extract caption position calculation into a reusable function
  const calculateCaptionPosition = async () => {
    if (!selectedTemplate) return;
    
    try {
      const video = document.createElement('video');
      video.src = selectedTemplate.video_url;
      
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => resolve();
      });
      
      const canvasHeight = 1920;
      const videoAspect = video.videoWidth / video.videoHeight || 16/9;
      const targetWidth = 1080;
      const targetHeight = targetWidth / videoAspect;
      const yOffset = (canvasHeight - targetHeight) / 2;
      const topOfVideo = yOffset;
      const positionAbove = topOfVideo - 15;
      const positionPercentage = Math.round((positionAbove / canvasHeight) * 100);
      
      setTextSettings(prev => ({
        ...prev,
        verticalPosition: positionPercentage
      }));
      
      hasCalculatedPositionRef.current = selectedTemplate.id;
      
      // Update preview after a short delay to ensure state has updated
      setTimeout(() => {
        updatePreview();
      }, 100);
    } catch (error) {
      console.error('Error calculating caption position:', error);
    }
  };

  // Update useEffect for caption positioning to use the new function
  useEffect(() => {
    if (!isGreenscreenMode && selectedTemplate) {
      // Skip if we've already calculated for this template
      if (hasCalculatedPositionRef.current === selectedTemplate.id) {
        return;
      }
      
      /**
       * Caption Placement Algorithm
       * 
       * For non-greenscreen (regular) mode, we automatically position the caption 15px above
       * the top edge of the video. This creates a visually pleasing default position that works
       * well with most templates. Key aspects of this approach:
       * 
       * 1. The BOTTOM of the LAST LINE of text is positioned 15px above the video
       * 2. We calculate what percentage of the canvas height this position represents
       * 3. We handle multiple lines of text through additional logic in the drawing functions
       * 
       * For greenscreen mode, we use a fixed 25% from the top which works better with the
       * full-height video + background composition.
       * 
       * This positioning is only calculated once per template and stored in a ref to avoid
       * unnecessary recalculations that could lead to performance issues or visual jitter.
       * 
       * Note: The drawing code in previewGenerator.ts and videoProcessor.ts has been updated
       * to ensure the BOTTOM of the LAST line is at the specified position.
       */
      calculateCaptionPosition();
    } else if (isGreenscreenMode) {
      // Reset to default 25% for greenscreen mode
      // For greenscreen templates, a fixed position works better as the video takes the full height
      setTextSettings(prev => ({
        ...prev,
        verticalPosition: 25
      }));
      
      // Clear the ref when switching to greenscreen mode to allow recalculation if needed
      hasCalculatedPositionRef.current = null;
    }
  }, [isGreenscreenMode, selectedTemplate]);

  const handleAISelection = (template: MemeTemplate, aiCaption: string, allOptions: SelectedMeme) => {
    setSelectedTemplate(template);
    setCaption(aiCaption);
    setGeneratedOptions(allOptions);
    setIsCropped(false);
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      setSelectedTemplate(null);
      setCaption('');
    }
  };

  const handleDownloadMeme = async () => {
    if (!selectedTemplate || !caption.trim()) {
      toast.error('Please provide a caption for your meme');
      return;
    }

    if (isGreenscreenMode && !selectedBackground) {
      toast.error('Please select a background image');
      return;
    }

    setIsDownloading(true);
    try {
      const videoBlob = await createMemeVideo(
        selectedTemplate.video_url,
        caption,
        selectedBackground?.url,
        isGreenscreenMode,
        textSettings,
        labels,
        labelSettings,
        isCropped
      );

      // Create download link and trigger download immediately
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meme-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Meme downloaded successfully!');
    } catch (error) {
      console.error('Error downloading meme:', error);
      toast.error('Failed to download meme. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const updateTextSetting = (key: keyof TextSettings, value: number | string) => {
    setTextSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const updatePreview = async () => {
    if (!selectedTemplate) return;
    
    try {
      // If we're in crop mode but haven't calculated the position yet, do it first
      if (isCropped && hasCalculatedPositionRef.current !== selectedTemplate.id) {
        await calculateCaptionPosition();
        // The preview will be updated in the calculateCaptionPosition function
        return;
      }
      
      // Generate a new preview canvas
      const canvas = await createMemePreview(
        selectedTemplate.video_url,
        caption,
        selectedBackground?.url,
        isGreenscreenMode,
        textSettings,
        labels,
        labelSettings,
        isCropped
      );
      
      // When previewCanvas exists, update its content, otherwise set the new canvas
      if (previewCanvas) {
        // If dimensions have changed (which happens during crop toggle), recreate the canvas
        if (previewCanvas.width !== canvas.width || previewCanvas.height !== canvas.height) {
          setPreviewCanvas(canvas);
        } else {
          // Just update the existing canvas content if dimensions are the same
          const ctx = previewCanvas.getContext('2d');
          ctx?.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
          ctx?.drawImage(canvas, 0, 0);
        }
      } else {
        // Set the new canvas 
        setPreviewCanvas(canvas);
      }
    } catch (error) {
      console.error('Error generating preview:', error);
      toast.error('Failed to generate preview');
    }
  };

  const addLabel = () => {
    const newLabel: Label = {
      id: uuidv4(),
      text: '',
      horizontalPosition: 50,
      verticalPosition: 50,
      size: labelSettings.size,
      font: labelSettings.font,
    };
    setLabels([...labels, newLabel]);
  };

  const updateLabel = (id: string, updates: Partial<Label>) => {
    setLabels(labels.map(label => 
      label.id === id ? { ...label, ...updates } : label
    ));
  };

  const deleteLabel = (id: string) => {
    setLabels(labels.filter(label => label.id !== id));
  };

  const searchUnsplash = useCallback(
    debounce(async (query: string, pageNum: number) => {
      if (!query.trim()) {
        setUnsplashImages([]);
        return;
      }

      setIsLoadingImages(true);
      try {
        const response = await fetch(
          `/api/unsplash/search?query=${encodeURIComponent(query)}&page=${pageNum}`
        );
        const data = await response.json();
        
        if (pageNum === 1) {
          setUnsplashImages(data.results);
        } else {
          setUnsplashImages(prev => [...prev, ...data.results]);
        }
      } catch (error) {
        console.error('Error searching Unsplash:', error);
        toast.error('Failed to load images');
      } finally {
        setIsLoadingImages(false);
      }
    }, 500),
    []
  );

  useEffect(() => {
    if (backgroundSearch.trim()) {
      searchUnsplash(backgroundSearch, page);
    }
  }, [backgroundSearch, page]);

  const updateLabelSetting = (key: keyof typeof labelSettings, value: number | string) => {
    setLabelSettings(prev => ({
      ...prev,
      [key]: value
    }));
    
    setLabels(labels.map(label => ({
      ...label,
      [key]: value
    })));
  };

  const handleCreateFromTemplate = (template: MemeTemplate, aiCaption: string, allOptions: SelectedMeme) => {
    setSelectedTemplate(template);
    setCaption(aiCaption);
    setGeneratedOptions(allOptions);
    setIsCropped(false);
    updatePreview();
  };

  // Toggle crop state
  const toggleCrop = () => {
    // Only allow cropping for non-greenscreen videos
    if (!isGreenscreenMode) {
      const newCropState = !isCropped;
      setIsCropped(newCropState);
      
      // Force a complete canvas recreation by setting previewCanvas to null first
      setPreviewCanvas(null);
      
      // If switching to cropped mode, make sure caption position is locked
      if (newCropState) {
        // Calculate top position if not already set
        if (hasCalculatedPositionRef.current !== selectedTemplate?.id) {
          calculateCaptionPosition();
        } else {
          // Position already calculated, just update preview
          setTimeout(() => {
            updatePreview();
          }, 10);
        }
      } else {
        // Switching to uncropped mode, reset to default position
        calculateCaptionPosition();
      }
    }
  };

  return (
    <div className="relative space-y-8">
      {isDownloading && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50 flex-col">
          <div className="relative">
            <BackgroundSVG width={300} height={300} />
            <div style={{ marginTop: '-30px' }}>
              <SpinningOrb width={240} height={240} color={{ r: 70, g: 140, b: 255 }} />
            </div>
          </div>
          <p className="mt-24 text-gray-300">Conjuring your meme...</p>
        </div>
      )}
      
      {!selectedTemplate ? (
        <AIMemeSelector 
          onSelectTemplate={handleAISelection} 
          isGreenscreenMode={isGreenscreenMode}
          onToggleMode={onToggleMode}
        />
      ) : (
        <div className="space-y-6">
          {/* Back button */}
          <div className="flex justify-between items-center">
            <button 
              onClick={handleBack} 
              className="flex items-center text-blue-400 hover:text-blue-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back
            </button>
            
            {/* Download button */}
            <button
              onClick={handleDownloadMeme}
              disabled={isDownloading || !caption.trim() || (isGreenscreenMode && !selectedBackground)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center"
            >
              {isDownloading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Download Meme
                </>
              )}
            </button>
          </div>

          <div className="border border-gray-700 rounded-lg p-4 bg-gray-800">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="w-full lg:w-1/2 space-y-4">
                <h2 className="text-lg font-medium mb-2 text-white">Editor</h2>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-2">
                    Caption
                  </h3>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="w-full p-3 border border-gray-600 bg-gray-900 text-white rounded-md focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Enter your caption..."
                  />
                </div>

                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-gray-300 hover:text-white">
                    Caption Settings
                  </summary>
                  <div className="mt-3 space-y-4 pl-2">
                    <div>
                      <label className="block text-xs text-gray-300 mb-1">Font</label>
                      <select
                        value={textSettings.font}
                        onChange={(e) => updateTextSetting('font', e.target.value)}
                        className="w-full p-2 text-sm border border-gray-600 bg-gray-800 text-white rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Impact">Impact (Classic Meme)</option>
                        <option value="Arial Black">Arial Black</option>
                        <option value="Comic Sans MS">Comic Sans MS</option>
                        <option value="Helvetica">Helvetica</option>
                        <option value="Futura">Futura</option>
                        <option value="Oswald">Oswald</option>
                        <option value="Anton">Anton</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Bebas Neue">Bebas Neue</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-300 mb-1">Size</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="40"
                          max="120"
                          value={textSettings.size}
                          onChange={(e) => updateTextSetting('size', parseInt(e.target.value))}
                          className="flex-1"
                        />
                        <span className="text-sm text-gray-300 w-12">{textSettings.size}</span>
                      </div>
                    </div>

                    {!isCropped && (
                      <div>
                        <label className="block text-xs text-gray-300 mb-1">Vertical Position</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="2"
                            max="95"
                            value={textSettings.verticalPosition}
                            onChange={(e) => updateTextSetting('verticalPosition', parseInt(e.target.value))}
                            className="flex-1"
                          />
                          <span className="text-sm text-gray-300 w-12">{textSettings.verticalPosition}%</span>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs text-gray-300 mb-1">Text Alignment</label>
                      <div className="flex gap-0 border border-gray-700 rounded-md overflow-hidden">
                        <button
                          onClick={() => updateTextSetting('alignment', 'left')}
                          className={`flex-1 p-2 text-sm ${
                            textSettings.alignment === 'left' 
                              ? 'bg-blue-900 text-blue-300' 
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Left
                        </button>
                        <div className="w-px bg-gray-600" />
                        <button
                          onClick={() => updateTextSetting('alignment', 'center')}
                          className={`flex-1 p-2 text-sm ${
                            textSettings.alignment === 'center' 
                              ? 'bg-blue-900 text-blue-300' 
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Center
                        </button>
                        <div className="w-px bg-gray-600" />
                        <button
                          onClick={() => updateTextSetting('alignment', 'right')}
                          className={`flex-1 p-2 text-sm ${
                            textSettings.alignment === 'right' 
                              ? 'bg-blue-900 text-blue-300' 
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Right
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-300 mb-1">Text Color</label>
                      <div className="flex gap-0 border rounded-md overflow-hidden">
                        <button
                          onClick={() => updateTextSetting('color', 'white')}
                          className={`flex-1 p-2 text-sm font-bold text-black bg-white flex items-center justify-center gap-1
                            ${textSettings.color === 'white' 
                              ? 'ring-2 ring-inset ring-blue-500' 
                              : 'hover:bg-gray-50'
                            }`}
                        >
                          {textSettings.color === 'white' && (
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          White
                        </button>
                        <div className="w-px bg-gray-200" />
                        <button
                          onClick={() => updateTextSetting('color', 'black')}
                          className={`flex-1 p-2 text-sm font-bold text-white bg-black flex items-center justify-center gap-1
                            ${textSettings.color === 'black' 
                              ? 'ring-2 ring-inset ring-blue-500' 
                              : 'hover:bg-opacity-90'
                            }`}
                        >
                          {textSettings.color === 'black' && (
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          Black
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-300 mb-1">Stroke Weight</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="20"
                          value={Math.round(textSettings.strokeWeight * 100)}
                          onChange={(e) => updateTextSetting('strokeWeight', parseInt(e.target.value) / 100)}
                          className="flex-1"
                        />
                        <span className="text-sm text-gray-300 w-12">{Math.round(textSettings.strokeWeight * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </details>

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-medium text-gray-300">Labels</h3>
                    <button
                      onClick={addLabel}
                      className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100"
                    >
                      Add Label
                    </button>
                  </div>

                  {labels.map(label => (
                    <div key={label.id} className="space-y-3 mb-4 p-3 bg-gray-700 rounded-lg">
                      <input
                        type="text"
                        value={label.text}
                        onChange={(e) => updateLabel(label.id, { text: e.target.value })}
                        placeholder="Enter label text..."
                        className="w-full p-2 text-sm border border-gray-600 bg-gray-800 text-white rounded-md focus:ring-2 focus:ring-blue-500"
                      />

                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-300 mb-1">Horizontal</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={label.horizontalPosition}
                              onChange={(e) => updateLabel(label.id, { horizontalPosition: parseInt(e.target.value) })}
                              className="flex-1"
                            />
                            <span className="text-sm text-gray-300 w-12">{label.horizontalPosition}%</span>
                          </div>
                        </div>

                        <div className="flex-1">
                          <label className="block text-xs text-gray-300 mb-1">Vertical</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={label.verticalPosition}
                              onChange={(e) => updateLabel(label.id, { verticalPosition: parseInt(e.target.value) })}
                              className="flex-1"
                            />
                            <span className="text-sm text-gray-300 w-12">{label.verticalPosition}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end mt-3">
                        <button
                          onClick={() => deleteLabel(label.id)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}

                  {labels.length > 0 && (
                    <details className="mt-4 mb-6">
                      <summary className="cursor-pointer text-sm text-gray-300 hover:text-white">
                        Label Style (All Labels)
                      </summary>
                      <div className="mt-3 space-y-4 pl-2 p-3 bg-gray-700 rounded-lg">
                        <div>
                          <label className="block text-xs text-gray-300 mb-1">Font</label>
                          <select
                            value={labelSettings.font}
                            onChange={(e) => updateLabelSetting('font', e.target.value)}
                            className="w-full p-2 text-sm border border-gray-600 bg-gray-800 text-white rounded-md focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="Impact">Impact (Classic Meme)</option>
                            <option value="Arial Black">Arial Black</option>
                            <option value="Comic Sans MS">Comic Sans MS</option>
                            <option value="Helvetica">Helvetica</option>
                            <option value="Futura">Futura</option>
                            <option value="Oswald">Oswald</option>
                            <option value="Anton">Anton</option>
                            <option value="Roboto">Roboto</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Verdana">Verdana</option>
                            <option value="Courier New">Courier New</option>
                            <option value="Bebas Neue">Bebas Neue</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-300 mb-1">Size</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="40"
                              max="120"
                              value={labelSettings.size}
                              onChange={(e) => updateLabelSetting('size', parseInt(e.target.value))}
                              className="flex-1"
                            />
                            <span className="text-sm text-gray-300 w-12">{labelSettings.size}</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-300 mb-1">Text Color</label>
                          <div className="flex gap-0 border rounded-md overflow-hidden">
                            <button
                              onClick={() => updateLabelSetting('color', 'white')}
                              className={`flex-1 p-2 text-sm font-bold text-black bg-white flex items-center justify-center gap-1
                                ${labelSettings.color === 'white' 
                                  ? 'ring-2 ring-inset ring-blue-500' 
                                  : 'hover:bg-gray-50'
                                }`}
                            >
                              {labelSettings.color === 'white' && (
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              White
                            </button>
                            <div className="w-px bg-gray-200" />
                            <button
                              onClick={() => updateLabelSetting('color', 'black')}
                              className={`flex-1 p-2 text-sm font-bold text-white bg-black flex items-center justify-center gap-1
                                ${labelSettings.color === 'black' 
                                  ? 'ring-2 ring-inset ring-blue-500' 
                                  : 'hover:bg-opacity-90'
                                }`}
                            >
                              {labelSettings.color === 'black' && (
                                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              Black
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-300 mb-1">Background Color</label>
                          <div className="flex gap-0 border rounded-md overflow-hidden">
                            <button
                              onClick={() => updateLabelSetting('backgroundColor', 'black')}
                              className={`flex-1 p-2 text-sm font-bold text-white bg-black flex items-center justify-center gap-1
                                ${labelSettings.backgroundColor === 'black' 
                                  ? 'ring-2 ring-inset ring-blue-500' 
                                  : 'hover:bg-opacity-90'
                                }`}
                            >
                              {labelSettings.backgroundColor === 'black' && (
                                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              Black
                            </button>
                            <div className="w-px bg-gray-200" />
                            <button
                              onClick={() => updateLabelSetting('backgroundColor', 'white')}
                              className={`flex-1 p-2 text-sm font-bold text-black bg-white flex items-center justify-center gap-1
                                ${labelSettings.backgroundColor === 'white' 
                                  ? 'ring-2 ring-inset ring-blue-500' 
                                  : 'hover:bg-gray-50'
                                }`}
                            >
                              {labelSettings.backgroundColor === 'white' && (
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              White
                            </button>
                            <div className="w-px bg-gray-200" />
                            <button
                              onClick={() => updateLabelSetting('backgroundColor', 'transparent')}
                              className={`flex-1 p-2 text-sm font-bold text-white bg-gray-700 flex items-center justify-center gap-1
                                ${labelSettings.backgroundColor === 'transparent' 
                                  ? 'ring-2 ring-inset ring-blue-500' 
                                  : 'hover:bg-gray-600'
                                }`}
                            >
                              {labelSettings.backgroundColor === 'transparent' && (
                                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              None
                            </button>
                          </div>
                        </div>

                        {labelSettings.backgroundColor !== 'transparent' && (
                          <div>
                            <label className="block text-xs text-gray-300 mb-1">Background Opacity</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min="10"
                                max="100"
                                value={Math.round(labelSettings.backgroundOpacity * 100)}
                                onChange={(e) => updateLabelSetting('backgroundOpacity', parseInt(e.target.value) / 100)}
                                className="flex-1"
                              />
                              <span className="text-sm text-gray-300 w-12">{Math.round(labelSettings.backgroundOpacity * 100)}%</span>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs text-gray-300 mb-1">Stroke Weight</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="20"
                              value={Math.round(labelSettings.strokeWeight * 100)}
                              onChange={(e) => updateLabelSetting('strokeWeight', parseInt(e.target.value) / 100)}
                              className="flex-1"
                            />
                            <span className="text-sm text-gray-300 w-12">{Math.round(labelSettings.strokeWeight * 100)}%</span>
                          </div>
                        </div>
                      </div>
                    </details>
                  )}
                </div>

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
                        <h3 className="text-sm font-medium mb-2">Background</h3>
                        {selectedBackground ? (
                          <div className="relative aspect-[9/16] rounded-lg overflow-hidden border">
                            <img 
                              src={selectedBackground.url} 
                              alt={selectedBackground.name}
                              className="w-full h-full object-cover"
                            />
                            <button
                              onClick={() => setSelectedBackground(null)}
                              className="absolute top-2 right-2 p-1 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-75"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setIsUnsplashPickerOpen(true)}
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
                    <div>
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
              </div>

              <div className="w-full lg:w-1/2">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-medium">Preview</h2>
                  {!isGreenscreenMode && selectedTemplate && (
                    <button
                      onClick={toggleCrop}
                      className={`text-sm px-3 py-1 rounded-full ${
                        isCropped 
                          ? 'bg-blue-600 text-white hover:bg-blue-700' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                      title={isCropped ? "Expand video to full height" : "Crop video to compact size"}
                    >
                      {isCropped ? 'Uncrop' : 'Crop'}
                    </button>
                  )}
                </div>
                <div className="lg:sticky lg:top-4 relative z-10">
                  <div className={`relative ${isCropped ? 'aspect-auto bg-black' : 'aspect-[9/16] bg-black'} w-full rounded-lg overflow-hidden flex flex-col items-center justify-center`}>
                    {previewCanvas ? (
                      <img 
                        src={previewCanvas.toDataURL()} 
                        alt="Meme preview"
                        className={`max-w-full ${isCropped ? 'h-auto' : 'h-full object-contain'}`}
                      />
                    ) : (
                      <div className="text-gray-400">
                        <p className="text-sm">Preview will appear here</p>
                      </div>
                    )}
                  </div>
                </div>

                {selectedBackground && typeof selectedBackground === 'object' && selectedBackground.attribution && (
                  <>
                    <div className="text-xs text-gray-500 mt-1.5 relative z-0">
                      Background by{' '}
                      <a 
                        href={selectedBackground.attribution?.photographerUrl || `https://unsplash.com/photos/${selectedBackground.id}?utm_source=meme_mage&utm_medium=referral`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 underline"
                      >
                        {selectedBackground.name.replace('Unsplash photo by ', '')}
                      </a>
                      {' '}on{' '}
                      <a
                        href="https://unsplash.com/?utm_source=meme_mage&utm_medium=referral&utm_campaign=api-credit"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 underline"
                      >
                        Unsplash
                      </a>
                    </div>
                    <div className="mt-3 mb-2 relative z-0">
                      <p className="text-xs text-gray-600 mb-1 font-medium">You must credit the photographer when sharing:</p>
                      <div className="relative">
                        <input 
                          type="text" 
                          value={`Photo by ${selectedBackground.name.replace('Unsplash photo by ', '')} on Unsplash${selectedBackground.attribution && 'instagram_username' in selectedBackground.attribution && selectedBackground.attribution.instagram_username ? `. Instagram: @${selectedBackground.attribution.instagram_username}` : `. Unsplash: @${selectedBackground.attribution?.username || ''}`}`}
                          readOnly 
                          className="text-xs px-3 py-2 border rounded w-full pr-10 bg-gray-700"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`Photo by ${selectedBackground.name.replace('Unsplash photo by ', '')} on Unsplash${selectedBackground.attribution && 'instagram_username' in selectedBackground.attribution && selectedBackground.attribution.instagram_username ? `. Instagram: @${selectedBackground.attribution.instagram_username}` : `. Unsplash: @${selectedBackground.attribution?.username || ''}`}`);
                            toast.success('Attribution copied to clipboard');
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1.5"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {generatedOptions && (
            <div>
              <h2 className="text-lg font-medium text-gray-300 mb-4">Other Options</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {generatedOptions.templates.map((templateData: TemplateData, templateIndex: number) => (
                  <div key={templateIndex} className="p-4 border border-gray-700 rounded-lg bg-gray-800">
                    <h3 className="font-medium mb-4 text-white">{templateData.template.name}</h3>
                    
                    <div className="space-y-3 mb-6">
                      <h4 className="font-medium text-blue-400">Captions:</h4>
                      {templateData.captions.map((captionOption: string, captionIndex: number) => (
                        <button
                          key={captionIndex}
                          onClick={() => handleCreateFromTemplate(templateData.template, captionOption, generatedOptions)}
                          className="w-full p-3 text-left border border-gray-700 text-white rounded-lg hover:bg-gray-700 hover:border-blue-400 transition-colors flex items-center gap-2"
                        >
                          <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-900 text-blue-300 text-sm">
                            {captionIndex + 1}
                          </span>
                          <span>{captionOption}</span>
                        </button>
                      ))}
                    </div>

                    <div className="border border-gray-700 rounded-lg overflow-hidden">
                      <video 
                        src={templateData.template.video_url}
                        className="w-full aspect-video object-cover"
                        controls
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ImagePicker
        isOpen={isUnsplashPickerOpen}
        onClose={() => setIsUnsplashPickerOpen(false)}
        onSelect={(image) => {
          console.log('DEBUG - Image selected:', image);
          // Ensure attribution is properly structured
          if (image.attribution) {
            // Make sure all required properties exist
            const attribution = {
              photographerName: image.attribution.photographerName || '',
              photographerUrl: image.attribution.photographerUrl || '',
              photoUrl: image.attribution.photoUrl || '',
              username: image.attribution.username || '',
              instagram_username: image.attribution.instagram_username || null
            };
            
            setSelectedBackground({
              ...image,
              attribution
            });
          } else {
            setSelectedBackground(image);
          }
          setIsUnsplashPickerOpen(false);
        }}
      />
    </div>
  );
} 