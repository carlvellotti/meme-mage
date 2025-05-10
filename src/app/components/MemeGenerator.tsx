'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { debounce } from '@/lib/utils/debounce';

// Local imports
import { MemeTemplate } from '@/lib/supabase/types';
import { BackgroundImage, TextSettings, SelectedMeme } from '@/lib/types/meme';
import { UnsplashImage } from '@/lib/types/unsplash';
import { createClient } from '@/lib/supabase/client';

// Components
import AIMemeSelector from './AIMemeSelector';
import ImagePicker from '@/app/components/ImagePicker';
import SpinningOrb from './SpinningOrb';
import BackgroundSVG from './BackgroundSVG';
import ExportButton from './MemeGenerator/ExportButton';
import TextOverlayForm from './MemeGenerator/TextOverlayForm';
import MemeCanvas from './MemeGenerator/MemeCanvas';
import ImageUpload from './MemeGenerator/ImageUpload';
import LabelControls from './MemeGenerator/LabelControls';
import WatermarkControls from './MemeGenerator/WatermarkControls';
import BackButton from './MemeGenerator/BackButton';
import FeedbackButtons from './MemeGenerator/FeedbackButtons';
import CropToggle from './MemeGenerator/CropToggle';

// Import from useLabels hook
import { useLabels, Label, CommonLabelSettings } from '@/app/lib/hooks/useLabels';

// Import from useVideoProcessing hook
import { useVideoProcessing, WatermarkSettings, GeneratePreviewParams, ProcessAndDownloadParams } from '@/app/lib/hooks/useVideoProcessing';

const WATERMARK_SETTINGS_KEY = 'memeGenerator_watermarkSettings';
const WATERMARK_ENABLED_KEY = 'memeGenerator_isWatermarkEnabled';

interface MemeGeneratorProps {
  isGreenscreenMode: boolean;
  onToggleMode: () => void;
  initialTemplate?: MemeTemplate;
  initialCaption?: string;
  initialOptions?: SelectedMeme;
  onBack?: () => void;
  personaId?: string | null;
  personaName?: string | null;
}

function sanitizeFilename(name: string): string {
  let sanitized = name.replace(/[@\\/:*?"<>|\s]/g, '_');
  sanitized = sanitized.replace(/^_+|_+$/g, '');
  return sanitized.substring(0, 50); 
}

export default function MemeGenerator({ 
  isGreenscreenMode, 
  onToggleMode, 
  initialTemplate, 
  initialCaption, 
  initialOptions,
  onBack,
  personaId,
  personaName
}: MemeGeneratorProps) {
  const supabase = createClient();

  const {
    isProcessing,
    currentPreview,
    generatePreview,
    processAndDownloadMeme
  } = useVideoProcessing();

  const [selectedTemplate, setSelectedTemplate] = useState<MemeTemplate | null>(initialTemplate || null);
  const [caption, setCaption] = useState<string>(initialCaption || '');
  const [generatedOptions, setGeneratedOptions] = useState<SelectedMeme | null>(initialOptions || null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundImage | null>(null);
  const [backgrounds, setBackgrounds] = useState<BackgroundImage[]>([]);
  const [isLoadingBackgrounds, setIsLoadingBackgrounds] = useState(false);
  const [textSettings, setTextSettings] = useState<TextSettings>({
    size: 78,
    font: 'Arial',
    verticalPosition: isGreenscreenMode ? 25 : 25,
    alignment: 'center',
    color: 'white',
    strokeWeight: 0.08,
  });
  const [{ labels, labelSettings }, dispatchLabelsAction] = useLabels();
  const [backgroundSearch, setBackgroundSearch] = useState('');
  const [unsplashImages, setUnsplashImages] = useState<UnsplashImage[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [page, setPage] = useState(1);
  const [isUnsplashPickerOpen, setIsUnsplashPickerOpen] = useState(false);
  const [isCropped, setIsCropped] = useState(false);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [isWatermarkEnabled, setIsWatermarkEnabled] = useState<boolean>(false);
  const [feedbackStatus, setFeedbackStatus] = useState<'used' | 'dont_use' | null>(null);
  const [watermarkSettings, setWatermarkSettings] = useState<WatermarkSettings>({
    text: personaName || '',
    horizontalPosition: 98,
    verticalPosition: 98,
    size: 60,
    font: 'Arial',
    color: 'black',
    strokeWeight: 0,
    opacity: 0.5,
    backgroundColor: 'transparent',
    backgroundOpacity: 0.5,
  });

  const hasCalculatedPositionRef = useRef<string | null>(null);

  const createPreviewParams = useCallback((): GeneratePreviewParams | null => {
    if (!selectedTemplate) return null;
    return {
      videoUrl: selectedTemplate.video_url,
      caption,
      backgroundUrl: selectedBackground?.url,
      isGreenscreenMode,
      textSettings,
      labels,
      labelSettings,
      isCropped,
      isWatermarkEnabled,
      watermarkSettings,
    };
  }, [selectedTemplate, caption, selectedBackground, isGreenscreenMode, textSettings, labels, labelSettings, isCropped, isWatermarkEnabled, watermarkSettings]);

  useEffect(() => {
    async function loadBackgrounds() {
      setIsLoadingBackgrounds(true);
      try {
        const { data, error } = await supabase.from('backgrounds').select('*').eq('aspect_ratio', '9:16');
        if (error) throw error;
        if (data) setBackgrounds(data);
      } catch (error) {
        console.error('Error loading backgrounds:', error);
        toast.error('Failed to load backgrounds');
      } finally {
        setIsLoadingBackgrounds(false);
      }
    }
    if (isGreenscreenMode) loadBackgrounds();
  }, [isGreenscreenMode, supabase]);

  // Central useEffect for triggering preview generation
  useEffect(() => {
    const params = createPreviewParams();
    if (params) {
      // Adding a slight delay can sometimes help if state updates that affect params are batched
      const timeoutId = setTimeout(() => generatePreview(params), 0);
      return () => clearTimeout(timeoutId); // Cleanup timeout if dependencies change quickly
    }
  }, [createPreviewParams, generatePreview]);

  // Initialize preview when component mounts with initial values
  useEffect(() => {
    if (initialTemplate && initialCaption) {
      const params: GeneratePreviewParams = {
        videoUrl: initialTemplate.video_url,
        caption: initialCaption,
        backgroundUrl: undefined,
        isGreenscreenMode,
        textSettings,
        labels,
        labelSettings,
        isCropped: false,
        isWatermarkEnabled,
        watermarkSettings,
      };
      generatePreview(params);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplate, initialCaption]); // Only run on initial mount based on these props

  const calculateCaptionPosition = useCallback(async () => {
    if (!selectedTemplate) return;
    try {
      const video = document.createElement('video');
      video.src = selectedTemplate.video_url;
      await new Promise<void>((resolve) => { video.onloadedmetadata = () => resolve(); video.onerror = () => resolve(); });
      const canvasHeight = 1920;
      const videoAspect = video.videoWidth / video.videoHeight || 16/9;
      const targetWidth = 1080;
      const targetHeight = targetWidth / videoAspect;
      const yOffset = (canvasHeight - targetHeight) / 2;
      const topOfVideo = yOffset;
      const positionAbove = topOfVideo - 15;
      const positionPercentage = Math.round((positionAbove / canvasHeight) * 100);
      setTextSettings(prev => ({ ...prev, verticalPosition: positionPercentage }));
      hasCalculatedPositionRef.current = selectedTemplate.id;
      // Preview generation will be handled by the central useEffect watching createPreviewParams (which includes textSettings)
    } catch (error) {
      console.error('Error calculating caption position:', error);
    }
  }, [selectedTemplate]); // createPreviewParams and generatePreview are not direct dependencies here

  // Effect for initial caption positioning and when template changes (if not greenscreen)
  useEffect(() => {
    if (!isGreenscreenMode && selectedTemplate && hasCalculatedPositionRef.current !== selectedTemplate.id) {
      calculateCaptionPosition();
    }
  }, [selectedTemplate, isGreenscreenMode, calculateCaptionPosition]);
  
  // Effect for greenscreen mode text position reset
  useEffect(() => {
    if (isGreenscreenMode) {
      setTextSettings(prev => ({ ...prev, verticalPosition: 25 }));
      hasCalculatedPositionRef.current = null;
       // Preview generation will be handled by the central useEffect watching createPreviewParams (which includes textSettings and isGreenscreenMode)
    }
  }, [isGreenscreenMode]);

  const handleAISelection = (template: MemeTemplate, aiCap: string, allOptions: SelectedMeme) => {
    setSelectedTemplate(template);
    setCaption(aiCap);
    setGeneratedOptions(allOptions);
    setIsCropped(false);
    // Preview update will be triggered by the central useEffect
  };

  const handleBack = () => {
    if (onBack) onBack();
    else { setSelectedTemplate(null); setCaption(''); }
  };

  const newHandleDownloadMeme = async () => {
    if (!selectedTemplate || !caption) {
      toast.error("Please select a template and add a caption first.");
      return;
    }
      const { data: { user } } = await supabase.auth.getUser();
      if (user && selectedTemplate?.id && initialCaption) {
      const { error: logError } = await supabase.from('meme_generation_log').insert({
        user_id: user.id, template_id: selectedTemplate.id, initial_ai_caption: initialCaption, final_user_caption: caption
      });
      if (logError) console.error('Error logging meme generation:', logError);
      else console.log('Meme generation logged successfully.');
      } else {
         console.warn('Could not log meme generation: Missing user, template ID, or initial caption.');
      }
      const timestamp = Date.now();
      const safePersonaName = personaName ? sanitizeFilename(personaName) : null;
    const fileName = safePersonaName ? `${safePersonaName}-meme-${timestamp}.mp4` : `meme-${timestamp}.mp4`;
    const baseParams = createPreviewParams();
    if (baseParams) {
        const downloadParams: ProcessAndDownloadParams = { ...baseParams, fileName };
        await processAndDownloadMeme(downloadParams);
    } else {
        toast.error("Could not prepare parameters for download.");
    }
  };

  const updateTextSetting = (key: keyof TextSettings, value: number | string) => {
    setTextSettings(prev => ({ ...prev, [key]: value }));
    // Preview will update via the central useEffect watching createPreviewParams
  };

  const searchUnsplash = useCallback(
    debounce(async (query: string, pageNum: number) => {
      if (!query.trim()) { setUnsplashImages([]); return; }
      setIsLoadingImages(true);
      try {
        const response = await fetch(`/api/unsplash/search?query=${encodeURIComponent(query)}&page=${pageNum}`);
        const data = await response.json();
        if (pageNum === 1) setUnsplashImages(data.results);
        else setUnsplashImages(prev => [...prev, ...data.results]);
      } catch (error) {
        console.error('Error searching Unsplash:', error);
        toast.error('Failed to load images');
      } finally { setIsLoadingImages(false); }
    }, 500), []
  );

  useEffect(() => {
    if (backgroundSearch.trim()) searchUnsplash(backgroundSearch, page);
  }, [backgroundSearch, page, searchUnsplash]);

  const handleCreateFromTemplate = (template: MemeTemplate, aiCap: string, allOptions: SelectedMeme) => {
    setSelectedTemplate(template);
    setCaption(aiCap);
    setGeneratedOptions(allOptions);
    setIsCropped(false);
    // Preview will update via the central useEffect
  };

  const toggleCrop = () => {
    if (!isGreenscreenMode) {
      const newCropState = !isCropped;
      setIsCropped(newCropState);
      // Preview generation is handled by the central useEffect (via createPreviewParams including isCropped)
      if (newCropState && selectedTemplate && hasCalculatedPositionRef.current !== selectedTemplate.id) {
          calculateCaptionPosition();
      } else if (!newCropState && selectedTemplate) {
        calculateCaptionPosition();
      }
    }
  };

  const handleFeedback = async (status: 'used' | 'dont_use') => {
    if (!personaId || !selectedTemplate?.id) {
      toast.error('Cannot submit feedback. Persona or template missing.');
      return;
    }
    setIsFeedbackLoading(true);
    const toastId = toast.loading(`Saving feedback...`);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: selectedTemplate.id, persona_id: personaId, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to save feedback');
      toast.success(`Feedback saved: Template marked as ${status === 'used' ? '\'used\'' : '\'don\'t use\''} for this persona.`, { id: toastId });
      setFeedbackStatus(status);
    } catch (err: any) {
      console.error("Feedback Error:", err);
      toast.error(err.message || 'Could not save feedback.', { id: toastId });
    } finally { setIsFeedbackLoading(false); }
  };

  const updateWatermarkSetting = (key: keyof WatermarkSettings, value: number | string) => {
    setWatermarkSettings(prev => ({ ...prev, [key]: value }));
    // Preview will update via the central useEffect watching createPreviewParams
  };

  useEffect(() => {
    let loadedSettings: Partial<WatermarkSettings> = {};
    const savedSettings = localStorage.getItem(WATERMARK_SETTINGS_KEY);
    if (savedSettings) try { loadedSettings = JSON.parse(savedSettings) as WatermarkSettings; } catch (e) { console.error("Failed to parse watermark settings from localStorage", e); }
    setWatermarkSettings(prev => ({
      ...prev, text: personaName || '', horizontalPosition: 98, verticalPosition: 98, size: 60, font: 'Arial', color: 'black', strokeWeight: 0, opacity: 0.5, backgroundColor: 'transparent', backgroundOpacity: 0.5, ...loadedSettings,
      ...(personaName && (!loadedSettings.text || loadedSettings.text === '') && { text: personaName })
    }));    
    const savedEnabled = localStorage.getItem(WATERMARK_ENABLED_KEY);
    if (savedEnabled !== null) setIsWatermarkEnabled(savedEnabled === 'true');
    else setIsWatermarkEnabled(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaName]);

  useEffect(() => {
    localStorage.setItem(WATERMARK_SETTINGS_KEY, JSON.stringify(watermarkSettings));
  }, [watermarkSettings]);
  
  useEffect(() => {
    localStorage.setItem(WATERMARK_ENABLED_KEY, String(isWatermarkEnabled));
  }, [isWatermarkEnabled]);

  if (!selectedTemplate) {
    return <AIMemeSelector onSelectTemplate={handleAISelection} isGreenscreenMode={isGreenscreenMode} onToggleMode={onToggleMode} />;
  }

  return (
    <div className="relative space-y-8">
      {isProcessing && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50 flex-col">
          <div className="relative"><BackgroundSVG width={300} height={300} /><div style={{ marginTop: '-30px' }}><SpinningOrb width={240} height={240} color={{ r: 70, g: 140, b: 255 }} /></div></div>
          <p className="mt-24 text-gray-300">Conjuring your meme...</p>
        </div>
      )}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
          <BackButton onClick={handleBack} />
          <ExportButton onDownload={newHandleDownloadMeme} isDownloading={isProcessing} disabled={!caption.trim() || (isGreenscreenMode && !selectedBackground)} />
          </div>
          <div className="border border-gray-700 rounded-lg p-4 bg-gray-800">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="w-full lg:w-1/2 space-y-4">
                <h2 className="text-lg font-medium mb-2 text-white">Editor</h2>
              <TextOverlayForm caption={caption} onCaptionChange={setCaption} textSettings={textSettings} onTextSettingChange={updateTextSetting} isCropped={isCropped} />
              <LabelControls labels={labels} labelSettings={labelSettings} dispatch={dispatchLabelsAction} />
              <WatermarkControls isWatermarkEnabled={isWatermarkEnabled} onToggleWatermark={setIsWatermarkEnabled} watermarkSettings={watermarkSettings} onWatermarkSettingChange={updateWatermarkSetting} />
              <ImageUpload selectedTemplate={selectedTemplate} isGreenscreenMode={isGreenscreenMode} previewVideoRef={previewVideoRef} selectedBackground={selectedBackground} onClearBackground={() => setSelectedBackground(null)} onOpenImagePicker={() => setIsUnsplashPickerOpen(true)} />
                {personaId && selectedTemplate && (
                <FeedbackButtons onFeedback={handleFeedback} isLoading={isFeedbackLoading} currentStatus={feedbackStatus} />
                )}
              </div>
              <div className="w-full lg:w-1/2">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-medium">Preview</h2>
                  {!isGreenscreenMode && selectedTemplate && (
                  <CropToggle isCropped={isCropped} onToggleCrop={toggleCrop} disabled={isGreenscreenMode} />
                  )}
                </div>
                <div className="lg:sticky lg:top-4 relative z-10">
                <MemeCanvas previewCanvas={currentPreview} isCropped={isCropped} />
                      </div>
                {selectedBackground && typeof selectedBackground === 'object' && selectedBackground.attribution && (
                  <>
                    <div className="text-xs text-gray-500 mt-1.5 relative z-0">
                    Background by{' '}<a href={selectedBackground.attribution?.photographerUrl || `https://unsplash.com/photos/${selectedBackground.id}?utm_source=meme_mage&utm_medium=referral`} target="_blank" rel="noopener noreferrer" className="text-gray-500 underline">{selectedBackground.name.replace('Unsplash photo by ', '')}</a>{' '}on{' '}<a href="https://unsplash.com/?utm_source=meme_mage&utm_medium=referral&utm_campaign=api-credit" target="_blank" rel="noopener noreferrer" className="text-gray-500 underline">Unsplash</a>
                    </div>
                    <div className="mt-3 mb-2 relative z-0">
                      <p className="text-xs text-gray-600 mb-1 font-medium">You must credit the photographer when sharing:</p>
                      <div className="relative">
                      <input type="text" value={`Photo by ${selectedBackground.name.replace('Unsplash photo by ', '')} on Unsplash${selectedBackground.attribution && 'instagram_username' in selectedBackground.attribution && selectedBackground.attribution.instagram_username ? `. Instagram: @${selectedBackground.attribution.instagram_username}` : `. Unsplash: @${selectedBackground.attribution?.username || ''}`}`} readOnly className="text-xs px-3 py-2 border rounded w-full pr-10 bg-gray-700" />
                      <button onClick={() => { navigator.clipboard.writeText(`Photo by ${selectedBackground.name.replace('Unsplash photo by ', '')} on Unsplash${selectedBackground.attribution && 'instagram_username' in selectedBackground.attribution && selectedBackground.attribution.instagram_username ? `. Instagram: @${selectedBackground.attribution.instagram_username}` : `. Unsplash: @${selectedBackground.attribution?.username || ''}`}`); toast.success('Attribution copied to clipboard'); }} className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      <ImagePicker isOpen={isUnsplashPickerOpen} onClose={() => setIsUnsplashPickerOpen(false)} onSelect={(image) => {
          if (image.attribution) {
            const attribution = { photographerName: image.attribution.photographerName || '', photographerUrl: image.attribution.photographerUrl || '', photoUrl: image.attribution.photoUrl || '', username: image.attribution.username || '', instagram_username: image.attribution.instagram_username || null };
            setSelectedBackground({ ...image, attribution });
          } else { setSelectedBackground(image); }
          setIsUnsplashPickerOpen(false);
        }}
      />
    </div>
  );
} 