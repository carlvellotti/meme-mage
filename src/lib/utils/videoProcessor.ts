// Add type declaration at the top of the file
declare global {
  interface HTMLVideoElement {
    captureStream(): MediaStream;
  }
  interface HTMLCanvasElement {
    captureStream(frameRate?: number): MediaStream;
  }
  interface HTMLAudioElement {
    captureStream(): MediaStream;
  }
}

import { TextSettings } from '@/lib/types/meme';

// <<< Add WatermarkSettings interface >>>
interface WatermarkSettings {
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

// Add Label interface at the top
interface Label {
  id: string;
  text: string;
  horizontalPosition: number;
  verticalPosition: number;
  size: number;
  font: string;
}

// <<< Define drawWatermark function BEFORE createMemeVideo >>>
function drawWatermark(
  ctx: CanvasRenderingContext2D,
  finalX: number,
  finalY: number,
  watermarkSettings: WatermarkSettings,
  canvasWidthForWrap: number 
) {
  // ... implementation from previous step ...
  ctx.save();
  ctx.font = `${watermarkSettings.size}px ${watermarkSettings.font}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';

  const watermarkX = finalX;
  const watermarkY = finalY;

  const watermarkLines = wrapText(ctx, watermarkSettings.text, canvasWidthForWrap * 0.4);
  const watermarkLineHeight = watermarkSettings.size * 1.1;

  ctx.globalAlpha = watermarkSettings.opacity;

  if (watermarkSettings.backgroundColor !== 'transparent') {
    ctx.fillStyle = watermarkSettings.backgroundColor;
    const backgroundEffectiveOpacity = watermarkSettings.backgroundOpacity * watermarkSettings.opacity;
    ctx.globalAlpha = backgroundEffectiveOpacity;

    let maxLineWidth = 0;
    watermarkLines.forEach(line => {
      const metrics = ctx.measureText(line);
      if (metrics.width > maxLineWidth) maxLineWidth = metrics.width;
    });

    const padding = 5;
    const backgroundWidth = maxLineWidth + padding * 2;
    const backgroundHeight = (watermarkLines.length * watermarkLineHeight) + padding * 2;
    const backgroundX = watermarkX - backgroundWidth;
    const backgroundY = watermarkY - backgroundHeight;

    ctx.fillRect(backgroundX, backgroundY, backgroundWidth, backgroundHeight);
  }

  ctx.globalAlpha = watermarkSettings.opacity;

  watermarkLines.reverse().forEach((line, index) => {
    const currentLineY = watermarkY - (index * watermarkLineHeight);
    if (watermarkSettings.strokeWeight > 0) {
      ctx.lineWidth = watermarkSettings.size * watermarkSettings.strokeWeight;
      ctx.strokeStyle = watermarkSettings.color === 'white' ? 'black' : 'white';
      ctx.strokeText(line, watermarkX, currentLineY);
    }
    ctx.fillStyle = watermarkSettings.color;
    ctx.fillText(line, watermarkX, currentLineY);
  });
  watermarkLines.reverse();

  ctx.restore();
}

// Helper function to draw background video with effects
function drawBackgroundVideo(
  ctx: CanvasRenderingContext2D, 
  backgroundVideo: HTMLVideoElement, 
  canvasWidth: number, 
  canvasHeight: number
) {
  // Save current context state
  ctx.save();
  
  // Apply blur filter and dark tint
  ctx.filter = 'blur(40px) brightness(0.2)';
  
  // Draw the background video to fill entire canvas (stretch to exact dimensions)
  ctx.drawImage(backgroundVideo, 0, 0, canvasWidth, canvasHeight);
  
  // Restore context state (removes filter)
  ctx.restore();
}

// <<< Define wrapText if it's not already before createMemeVideo >>>
// Function definition for wrapText should be here or imported

export async function createMemeVideo(
  videoUrl: string,
  caption: string,
  backgroundImage?: string,
  isGreenscreen?: boolean,
  textSettings?: TextSettings,
  labels?: Label[],
  labelSettings?: {
    font: string;
    size: number;
    color: 'white' | 'black';
    strokeWeight: number;
    backgroundColor?: 'black' | 'white' | 'transparent';
    backgroundOpacity?: number;
  },
  isCropped?: boolean,
  isWatermarkEnabled?: boolean,
  watermarkSettings?: WatermarkSettings,
  videoVerticalOffset?: number,
  backgroundVideoUrl?: string
): Promise<Blob> {
  // Create a container to hold and control all media elements
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  document.body.appendChild(container);
  
  try {
    // Step 1: Load all media resources first
    const videoElement = await loadVideo(videoUrl);
    videoElement.muted = true; // Mute the original video element to prevent double audio
    container.appendChild(videoElement);
    
    let backgroundImageElement = null;
    if (isGreenscreen && backgroundImage) {
      backgroundImageElement = await loadImage(backgroundImage);
    }

    // Load background video for non-greenscreen mode
    let backgroundVideoElement = null;
    let isBackgroundVideoReady = false;
    
    if (!isGreenscreen && backgroundVideoUrl) {
      try {
        backgroundVideoElement = await loadVideo(backgroundVideoUrl);
        backgroundVideoElement.muted = true;
        backgroundVideoElement.loop = true;
        backgroundVideoElement.playbackRate = 0.5; // Slow motion effect
        
        // Set up proper synchronization for background video
        backgroundVideoElement.onseeked = () => {
          isBackgroundVideoReady = true;
        };
        
        backgroundVideoElement.onerror = () => {
          console.warn('Background video error during seek');
          isBackgroundVideoReady = true; // Allow processing to continue
        };
        
        // Set timeout as fallback in case seeking takes too long
        setTimeout(() => {
          if (!isBackgroundVideoReady) {
            console.warn('Background video seek timeout, proceeding anyway');
            isBackgroundVideoReady = true;
          }
        }, 2000); // 2 second timeout
        
        // Set initial position and wait for seek
        backgroundVideoElement.currentTime = 0.1;
        
        container.appendChild(backgroundVideoElement);
      } catch (error) {
        console.warn('Failed to load background video:', error);
        backgroundVideoElement = null;
        isBackgroundVideoReady = true; // Allow processing to continue
      }
    } else {
      isBackgroundVideoReady = true; // No background video, so we're ready
    }

    // Step 2: Set up canvas with proper dimensions
    const canvas = document.createElement('canvas');
    
    // Standard canvas dimensions
    const standardWidth = 1080;
    const standardHeight = 1920;
    
    // Calculate video dimensions and position
    const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
    const targetWidth = standardWidth;
    const targetHeight = targetWidth / videoAspect;
    let yOffset = (standardHeight - targetHeight) / 2;
    
    // If crop mode is enabled and we're not in greenscreen mode
    if (isCropped && !isGreenscreen) {
      // For height calculation, we need to estimate the text height first
      const fontSize = textSettings?.size || 78;
      const estimatedLineHeight = fontSize * 1.1;
      
      // Assuming worst case of 3 lines of text, calculate estimated text height
      // This is just for initial canvas sizing, exact positioning will be done in render
      const estimatedTextLines = 3;
      const estimatedTextHeight = estimatedTextLines * estimatedLineHeight;
      
      // Calculate canvas height to include:
      // - 30px top padding
      // - Estimated text height
      // - 15px gap between text and video
      // - Video height
      // - 15px bottom padding
      const textTop = 30;
      const estimatedTextBottom = textTop + estimatedTextHeight;
      const estimatedVideoTop = estimatedTextBottom + 15;
      const newHeight = estimatedVideoTop + targetHeight + 15;
      
      // Set initial canvas dimensions for cropped mode - will be refined in renderFrame
      canvas.width = standardWidth;
      canvas.height = newHeight;
    } else {
      // Standard dimensions for non-cropped mode
      canvas.width = standardWidth;
      canvas.height = standardHeight;
    }
    
    const ctx = canvas.getContext('2d')!;
    container.appendChild(canvas);

    // Step 4: Create a rendering function
    const renderFrame = (watermarkEnabled: boolean, currentWatermarkSettings: WatermarkSettings | undefined) => {
      // Clear canvas with black background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw background video if available (non-greenscreen only)
      if (!isGreenscreen && backgroundVideoElement && isBackgroundVideoReady) {
        drawBackgroundVideo(ctx, backgroundVideoElement, canvas.width, canvas.height);
      }

      // Draw background if in greenscreen mode
      if (isGreenscreen && backgroundImageElement) {
        // For greenscreen mode, we don't apply crop (as per requirements)
        ctx.drawImage(backgroundImageElement, 0, 0, canvas.width, canvas.height);
        
        // Process video frame with greenscreen removal
        const processedFrame = processGreenscreen(videoElement, targetWidth, targetHeight);
        
        // Apply videoVerticalOffset if provided and not in cropped mode (for greenscreen)
        let finalYOffset = yOffset; // Default yOffset
        if (videoVerticalOffset !== undefined && !isCropped) { 
            const desiredCenterY = (standardHeight * videoVerticalOffset) / 100;
            const calculatedYOffset = desiredCenterY - (targetHeight / 2);
            finalYOffset = Math.max(0, Math.min(calculatedYOffset, standardHeight - targetHeight));
        }
        ctx.drawImage(processedFrame, 0, finalYOffset, targetWidth, targetHeight);
      } else {
        // Regular video drawing
        if (isCropped) {
          // First measure the text height
          const fontSize = textSettings?.size || 78;
          const font = textSettings?.font || 'Impact';
          const lineHeight = fontSize * 1.1; // Line height multiplier
          
          // Set up text for measurement
          ctx.font = `${fontSize}px ${font}`;
          
          // Handle text wrapping to determine actual text height
          const maxWidth = canvas.width - 80;
          const lines = wrapText(ctx, caption, maxWidth);
          const totalTextHeight = lines.length * lineHeight;
          
          // Calculate text position and spacing
          const textTop = 30; // 30px from top of cropped canvas (increased from 20px)
          const textBottom = textTop + totalTextHeight;
          
          // Position video 15px below the text
          const videoTop = textBottom + 15;
          
          // Calculate total height with 15px bottom padding
          const totalHeight = videoTop + targetHeight + 15;
          
          // If the canvas height doesn't match our calculation, resize it
          // This ensures consistency between preview and downloaded video
          if (Math.abs(canvas.height - totalHeight) > 2) { // Allow small rounding differences
            canvas.height = totalHeight;
            // Clear canvas since size changed
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          
          // Draw the video at the position below the text
          ctx.drawImage(videoElement, 0, videoTop, targetWidth, targetHeight);
        } else {
          // Standard video drawing
          // Apply videoVerticalOffset if provided and not in cropped mode
          let finalYOffset = yOffset; // Default yOffset
          if (videoVerticalOffset !== undefined && !isCropped) {
            const desiredCenterY = (standardHeight * videoVerticalOffset) / 100;
            const calculatedYOffset = desiredCenterY - (targetHeight / 2);
            finalYOffset = Math.max(0, Math.min(calculatedYOffset, standardHeight - targetHeight));
          }
          ctx.drawImage(videoElement, 0, finalYOffset, targetWidth, targetHeight);
        }
      }

      // Draw caption, labels, and watermark
      if (caption) {
        drawCaption(ctx, caption, canvas.width, canvas.height, textSettings, isCropped);
      }
      if (labels && labels.length > 0) {
        drawLabels(ctx, labels, canvas.width, canvas.height, labelSettings);
      }

      // <<< Draw Watermark >>>
      if (watermarkEnabled && currentWatermarkSettings && currentWatermarkSettings.text) {
        // <<< Calculate video bounds based on crop state >>>
        let videoRect = {
          x: 0,
          y: 0,
          width: targetWidth,
          height: targetHeight
        };

        if (isCropped && !isGreenscreen) {
           // Calculate cropped video top position
          const fontSize = textSettings?.size || 78;
          const font = textSettings?.font || 'Impact';
          const lineHeight = fontSize * 1.1;
          const maxWidth = canvas.width - 80;
          const lines = wrapText(ctx, caption, maxWidth);
          const totalTextHeight = lines.length * lineHeight;
          const textTop = 30;
          const textBottom = textTop + totalTextHeight;
          const currentVideoTop = textBottom + 15;

          videoRect.x = 0;
          videoRect.y = currentVideoTop;
        } else {
           // Standard video position (covers greenscreen and non-cropped)
          videoRect.x = 0;
          videoRect.y = yOffset; // Use the standard yOffset
        }

        // <<< Calculate final watermark coords relative to videoRect >>>
        const finalWatermarkX = videoRect.x + (currentWatermarkSettings.horizontalPosition / 100) * videoRect.width;
        const finalWatermarkY = videoRect.y + (currentWatermarkSettings.verticalPosition / 100) * videoRect.height;

        // <<< Call drawWatermark with final coordinates >>>
        drawWatermark(ctx, finalWatermarkX, finalWatermarkY, currentWatermarkSettings, canvas.width);
      }
    };

    // Step 5: Set up media recorder with proper audio handling
    const canvasStream = canvas.captureStream(30);
    
    // Create a separate audio element to handle audio properly
    const audioElement = document.createElement('audio');
    audioElement.src = videoUrl;
    audioElement.crossOrigin = 'anonymous';
    container.appendChild(audioElement);
    
    // Wait for audio to be ready
    await new Promise<void>((resolve) => {
      audioElement.onloadedmetadata = () => resolve();
      audioElement.onerror = () => resolve(); // Continue even if audio fails
    });
    
    // Get audio stream from the audio element
    let audioStream;
    try {
      audioStream = audioElement.captureStream();
    } catch (e) {
      console.warn('Could not capture audio stream, falling back to video audio');
      // Fallback to video audio if audio element capture fails
      audioStream = videoElement.captureStream();
    }
    
    // Add audio track to canvas stream
    const audioTracks = audioStream.getAudioTracks();
    if (audioTracks.length > 0) {
      canvasStream.addTrack(audioTracks[0]);
    }
    
    // Find supported mime type
    const mimeType = [
      'video/mp4;codecs=h264,aac',
      'video/mp4',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ].find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
    
    // Create media recorder
    const recorder = new MediaRecorder(canvasStream, {
      mimeType,
      videoBitsPerSecond: 8000000,
    });

    // Step 6: Start recording and return promise that resolves with the final video blob
    return new Promise<Blob>((resolve) => {
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        resolve(blob);
      };
      
      // Set up animation frame loop
      let animationFrameId: number;
      const updateCanvas = () => {
        renderFrame(isWatermarkEnabled || false, watermarkSettings);
        animationFrameId = requestAnimationFrame(updateCanvas);
      };
      
      // Get video duration to calculate early stop time
      const videoDuration = videoElement.duration;
      const earlyStopTime = Math.max(0, videoDuration - 0.1); // Stop 0.2s before the end
      
      // Set up a timeupdate listener to stop recording before the video ends
      const handleTimeUpdate = () => {
        if (videoElement.currentTime >= earlyStopTime) {
          // Remove the listener to prevent multiple calls
          videoElement.removeEventListener('timeupdate', handleTimeUpdate);
          
          // Cancel animation frame to stop rendering
          cancelAnimationFrame(animationFrameId);
          
          // Render one final frame to ensure we have a clean frame
          renderFrame(isWatermarkEnabled || false, watermarkSettings);
          
          // Stop the recorder immediately
          recorder.stop();
          
          // Stop all media
          videoElement.pause();
          audioElement.pause();
          
          // Stop background video if available
          if (backgroundVideoElement) {
            backgroundVideoElement.pause();
          }
          
          // Stop all tracks
          canvasStream.getTracks().forEach(track => track.stop());
          if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
          }
        }
      };
      
      // Add timeupdate listener to check current time
      videoElement.addEventListener('timeupdate', handleTimeUpdate);
      
      // Start at a specific time to ensure stable frame
      videoElement.currentTime = 0.1;
      audioElement.currentTime = 0.1;
      
      // Start background video if available
      if (backgroundVideoElement) {
        backgroundVideoElement.currentTime = 0.1;
      }
      
      // When video has seeked to the right position
      videoElement.onseeked = () => {
        // Remove event listener to prevent multiple calls
        videoElement.onseeked = null;
        
        // Function to check if all media is ready and start recording
        const startRecordingIfReady = () => {
          // Check if background video is ready (if we have one)
          if (backgroundVideoElement && !isBackgroundVideoReady) {
            // Background video not ready yet, wait a bit more
            setTimeout(startRecordingIfReady, 50);
            return;
          }
          
          // All media is ready, start recording
          recorder.start(100); // Capture in 100ms chunks for smoother recording
          
          // Start animation frame loop
          updateCanvas();
          
          // Play both video and audio in sync
          const playPromises = [
            videoElement.play(),
            audioElement.play()
          ];
          
          // Also play background video if available
          if (backgroundVideoElement) {
            playPromises.push(backgroundVideoElement.play());
          }
          
          // Handle any play errors
          Promise.all(playPromises).catch(error => {
            console.error('Error playing media:', error);
            // Try to continue anyway
          });
        };
        
        // Start the ready check
        startRecordingIfReady();
      };
    }).finally(() => {
      // Clean up all resources
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    });
  } catch (error) {
    // Clean up on error
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    throw error;
  }
}

// Helper function to load video and return a promise
function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    
    video.onloadedmetadata = () => {
      resolve(video);
    };
    
    video.onerror = (e) => {
      reject(new Error('Failed to load video'));
    };
    
    video.src = url;
  });
}

// Helper function to load image and return a promise
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      resolve(img);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

// Helper function to process greenscreen
function processGreenscreen(video: HTMLVideoElement, width: number, height: number): HTMLCanvasElement {
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCanvas.width = width;
  tempCanvas.height = height;
  
  // Draw video frame to temp canvas
  tempCtx.drawImage(video, 0, 0, width, height);
  
  // Get image data for processing
  const imageData = tempCtx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  // Green screen removal with improved thresholds
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    
    // Improved green screen detection
    if (g > 100 && g > 1.4 * r && g > 1.4 * b) {
      pixels[i + 3] = 0; // Make pixel transparent
    }
  }

  // Put processed frame back
  tempCtx.putImageData(imageData, 0, 0);
  
  return tempCanvas;
}

// Helper function to draw caption
function drawCaption(
  ctx: CanvasRenderingContext2D, 
  caption: string, 
  canvasWidth: number, 
  canvasHeight: number,
  textSettings?: TextSettings,
  isCropped?: boolean
) {
  if (!caption) return;

  const font = textSettings?.font || 'Impact';
  const size = textSettings?.size || 78;
  const color = textSettings?.color || 'white';
  const strokeWeight = textSettings?.strokeWeight || 0.08;
  const verticalPosition = textSettings?.verticalPosition || 25;
  const alignment = textSettings?.alignment || 'center';
  // NEW: Get text background settings
  const textBgColor = textSettings?.backgroundColor || 'transparent';
  const textBgOpacity = textSettings?.backgroundOpacity === undefined ? 0.5 : textSettings.backgroundOpacity;

  ctx.font = `${size}px ${font}`;
  ctx.textAlign = alignment as CanvasTextAlign;
  
  const maxWidth = canvasWidth - 80;
  const lines = wrapText(ctx, caption, maxWidth);
  const lineHeight = size * 1.1;

  let y;
  if (isCropped) {
    ctx.textBaseline = 'top';
    y = 30; // Fixed position 30px from top of cropped canvas
  } else {
    ctx.textBaseline = 'bottom';
    y = (canvasHeight * verticalPosition) / 100;
  }

  lines.forEach((line, index) => {
    let currentLineY;
    if (isCropped) {
      currentLineY = y + (index * lineHeight);
    } else {
      // Simplified Y calculation to match preview generator
      // Adjust position so the BOTTOM of the LAST line is at the specified vertical position
      currentLineY = y - (lines.length - 1 - index) * lineHeight;
    }

    const textMetrics = ctx.measureText(line);
    const textWidth = textMetrics.width;
    const actualTextHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent;
    const bgPadding = size * 0.1; // Padding for the background

    let x;
    if (alignment === 'left') x = 40;
    else if (alignment === 'right') x = canvasWidth - 40;
    else x = canvasWidth / 2; // Center

    // NEW: Draw text background
    if (textBgColor && textBgColor !== 'none' && textBgColor !== 'transparent' && textBgOpacity > 0) {
      ctx.globalAlpha = textBgOpacity;
      ctx.fillStyle = textBgColor;
      let bgX = x;
      if (alignment === 'center') {
        bgX = x - textWidth / 2;
      } else if (alignment === 'right') {
        bgX = x - textWidth;
      }
      
      let bgY;
      if (isCropped) {
        // textBaseline is 'top', so currentLineY is the top
        bgY = currentLineY - bgPadding;
      } else {
        // textBaseline is 'bottom', so calculate top of text
        bgY = (currentLineY - textMetrics.actualBoundingBoxAscent) - bgPadding;
      }

      ctx.fillRect(bgX - bgPadding, bgY, textWidth + (bgPadding * 2), actualTextHeight + (bgPadding * 2));
      ctx.globalAlpha = 1; // Reset globalAlpha
    }

    // Draw text stroke - FIX: multiply strokeWeight by font size
    ctx.lineWidth = size * strokeWeight;
    ctx.strokeStyle = color === 'white' ? '#000000' : '#FFFFFF';
    ctx.strokeText(line, x, currentLineY);
    
    // Draw text fill
    ctx.fillStyle = color;
    ctx.fillText(line, x, currentLineY);
  });
}

// Helper function to draw labels
function drawLabels(
  ctx: CanvasRenderingContext2D,
  labels: Label[],
  canvasWidth: number,
  canvasHeight: number,
  labelSettings?: {
    font: string;
    size: number;
    color: 'white' | 'black';
    strokeWeight: number;
    backgroundColor?: 'black' | 'white' | 'transparent';
    backgroundOpacity?: number;
  }
) {
  if (!labels || !labels.length) return;

  labels.forEach(label => {
    if (!label.text.trim()) return;

    const x = canvasWidth * (label.horizontalPosition / 100);
    const y = canvasHeight * (label.verticalPosition / 100);
    
    // Use label's font and size - remove "bold" to match preview generator
    ctx.font = `${label.size}px ${label.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Get text color and stroke weight from global settings
    const textColor = labelSettings?.color || 'white';
    const strokeWeight = labelSettings?.strokeWeight !== undefined 
      ? label.size * labelSettings.strokeWeight 
      : label.size * 0.08;
      
    // Get background settings from labelSettings, with defaults
    const bgColor = labelSettings?.backgroundColor || 'black';
    const bgOpacity = labelSettings?.backgroundOpacity !== undefined ? labelSettings.backgroundOpacity : 0.5;
    
    // Calculate approximate label width
    const metrics = ctx.measureText(label.text);
    const textWidth = metrics.width;
    
    // Draw a background rectangle if not transparent
    if (bgColor !== 'transparent') {
      const padding = 10;
      // Set background color and opacity
      if (bgColor === 'black') {
        ctx.fillStyle = `rgba(0, 0, 0, ${bgOpacity})`;
      } else if (bgColor === 'white') {
        ctx.fillStyle = `rgba(255, 255, 255, ${bgOpacity})`;
      }
      
      ctx.fillRect(
        x - textWidth / 2 - padding,
        y - label.size / 2 - padding / 2,
        textWidth + padding * 2,
        label.size + padding
      );
    }

    // Set stroke color to be opposite of text color for better visibility
    ctx.strokeStyle = textColor === 'white' ? '#000000' : '#FFFFFF';
    ctx.lineWidth = strokeWeight;
    ctx.strokeText(label.text, x, y);
    
    ctx.fillStyle = textColor === 'white' ? '#FFFFFF' : '#000000';
    ctx.fillText(label.text, x, y);
  });
}

// Helper function to wrap text
function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  // Split text into lines based on user's line breaks first
  const userLines = text.split('\n');
  const lines: string[] = [];

  // Then handle word wrapping within each line
  userLines.forEach(userLine => {
    if (userLine.trim() === '') {
      // Preserve empty lines
      lines.push('');
      return;
    }

    const words = userLine.split(' ');
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = context.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
  });

  return lines;
}
