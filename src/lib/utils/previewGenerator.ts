import { TextSettings } from '@/lib/types/meme';

// Add Label interface at the top
interface Label {
  id: string;
  text: string;
  horizontalPosition: number;
  verticalPosition: number;
  size: number;
  font: string;
}

// <<< Add WatermarkSettings interface (copy from MemeGenerator.tsx or define here) >>>
interface WatermarkSettings {
  text: string;
  horizontalPosition: number; // % from left
  verticalPosition: number;   // % from top
  size: number;
  font: string;
  color: 'white' | 'black';
  strokeWeight: number;
  opacity: number; // 0 to 1
  backgroundColor: 'black' | 'white' | 'transparent';
  backgroundOpacity: number; // 0 to 1
}

// Utility function to wrap text into lines
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

export async function createMemePreview(
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
    backgroundColor?: string;
    backgroundOpacity?: number;
  },
  isCropped?: boolean,
  // <<< Add watermark parameters >>>
  isWatermarkEnabled?: boolean,
  watermarkSettings?: WatermarkSettings,
  videoVerticalOffset?: number,
  backgroundVideoUrl?: string
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const backgroundImg = new Image();
    let backgroundVideoElement: HTMLVideoElement | null = null;
    let isBackgroundLoaded = false;
    let isBackgroundVideoLoaded = false;
    
    if (isGreenscreen && backgroundImage) {
      backgroundImg.crossOrigin = 'anonymous';
      backgroundImg.onload = () => {
        isBackgroundLoaded = true;
        if (video.readyState >= 2) {
          processFrame();
        }
      };
      backgroundImg.src = backgroundImage;
    }

    // Load background video for non-greenscreen mode
    if (!isGreenscreen && backgroundVideoUrl) {
      backgroundVideoElement = document.createElement('video');
      backgroundVideoElement.crossOrigin = 'anonymous';
      backgroundVideoElement.muted = true;
      backgroundVideoElement.loop = true;
      backgroundVideoElement.playbackRate = 0.3; // Slow motion effect
      
      backgroundVideoElement.onloadeddata = () => {
        // Set to start time immediately when loaded
        backgroundVideoElement!.currentTime = 0.1;
        isBackgroundVideoLoaded = true;
        if (video.readyState >= 2) {
          processFrame();
        }
      };
      
      backgroundVideoElement.onseeked = () => {
        // Ensure we're ready after seeking to start position
        if (isBackgroundVideoLoaded && video.readyState >= 2) {
          processFrame();
        }
      };
      
      backgroundVideoElement.onerror = (e) => {
        console.warn('Failed to load background video:', e);
        isBackgroundVideoLoaded = false;
        if (video.readyState >= 2) {
          processFrame();
        }
      };
      
      backgroundVideoElement.src = backgroundVideoUrl;
    }

    video.src = videoUrl;
    video.crossOrigin = 'anonymous';

    const processFrame = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      let canvasWidth = 1080;
      let canvasHeight = 1920;
      
      // Set up initial variables for video dimensions
      const videoAspect = video.videoWidth / video.videoHeight;
      const targetWidth = canvasWidth;
      const targetHeight = targetWidth / videoAspect;
      let yOffset = (canvasHeight - targetHeight) / 2;

      // If cropped mode is enabled (and not in greenscreen mode), adjust the canvas
      if (isCropped && !isGreenscreen) {
        // Calculate the position of the text above the video (15px above video top)
        const textPositionY = yOffset - 15;
        
        // Calculate font size and get ready to measure text dimensions
        const fontSize = textSettings?.size || 78;
        const font = textSettings?.font || 'Impact';
        const lineHeight = fontSize * 1.1; // Line height multiplier
        
        // Set up text for measurement
        ctx.font = `${fontSize}px ${font}`;
        
        // Handle text wrapping to determine actual text height
        const maxWidth = canvasWidth - 80;
        const lines = wrapText(ctx, caption, maxWidth);
        const totalTextHeight = lines.length * lineHeight;
        
        // We want to create a cropped canvas that:
        // 1. Has 30px padding above the text
        // 2. Has the full text height (now properly calculated)
        // 3. Has 15px padding between text and video
        // 4. Has the full video height
        // 5. Has 15px padding below the video
        
        // Calculate top crop line (we crop everything above this point)
        const topCrop = textPositionY - 30;
        
        // Calculate bottom of video
        const videoBottom = yOffset + targetHeight;
        
        // Calculate text bottom - where the text ends
        const textTop = 30; // 30px from top of cropped canvas (increased from 20px)
        const textBottom = textTop + totalTextHeight;
        
        // Position video 15px below the text
        const videoTop = textBottom + 15;
        
        // Calculate the new canvas height to include:
        // - 30px top padding
        // - Text height
        // - 15px gap between text and video
        // - Video height
        // - 15px bottom padding
        const newHeight = 30 + totalTextHeight + 15 + targetHeight + 15;
        
        // Make sure the canvas dimensions match our calculations exactly
        canvas.width = canvasWidth;
        canvas.height = newHeight;
        
        // Clear canvas with black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw background video if available (non-greenscreen only)
        if (!isGreenscreen && backgroundVideoElement && isBackgroundVideoLoaded) {
          drawBackgroundVideo(ctx, backgroundVideoElement, canvas.width, canvas.height);
        }

        if (isGreenscreen && isBackgroundLoaded) {
          // First draw the background
          ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);
          
          // Create a temporary canvas for the video frame
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d')!;
          tempCanvas.width = targetWidth;
          tempCanvas.height = targetHeight;
          
          // Draw video frame to temp canvas
          tempCtx.drawImage(video, 0, 0, targetWidth, targetHeight);
          
          // Get image data for processing
          const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
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
          
          // Draw processed frame onto main canvas
          // Apply videoVerticalOffset if provided and not in cropped mode (for greenscreen)
          let finalYOffset = yOffset; // Default yOffset
          if (videoVerticalOffset !== undefined && !isCropped) { // Check !isCropped directly
            const desiredCenterY = (canvasHeight * videoVerticalOffset) / 100;
            const calculatedYOffset = desiredCenterY - (targetHeight / 2);
            finalYOffset = Math.max(0, Math.min(calculatedYOffset, canvasHeight - targetHeight));
          }
          ctx.drawImage(tempCanvas, 0, finalYOffset, targetWidth, targetHeight);
        } else {
          // Regular video drawing
          // Apply videoVerticalOffset if provided and not in cropped mode
          let finalYOffset = yOffset; // Default yOffset
          if (videoVerticalOffset !== undefined && !isCropped) { // MODIFIED HERE
            const desiredCenterY = (canvasHeight * videoVerticalOffset) / 100;
            const calculatedYOffset = desiredCenterY - (targetHeight / 2);
            // Clamp to ensure video stays within canvas bounds
            finalYOffset = Math.max(0, Math.min(calculatedYOffset, canvasHeight - targetHeight));
          }
          ctx.drawImage(video, 0, finalYOffset, targetWidth, targetHeight);
        }
        
        // Draw caption above video
        if (caption) {
          // Set the caption drawing properties
          ctx.textAlign = 'center' as CanvasTextAlign;
          ctx.textBaseline = 'top';
          
          // Use defaults if no textSettings provided
          const color = textSettings?.color || 'white';
          const strokeWeight = textSettings?.strokeWeight || 0.08;
          
          // Configure text alignment
          const alignment = textSettings?.alignment || 'center';
          if (alignment === 'left') ctx.textAlign = 'left';
          else if (alignment === 'right') ctx.textAlign = 'right';
          else ctx.textAlign = 'center';
          
          // Calculate x position based on alignment
          const x = alignment === 'left' ? 40 : (alignment === 'right' ? canvas.width - 40 : canvas.width / 2);
          
          // Fixed position 20px from top of cropped canvas
          const y = textTop;
          
          // Configure text style
          ctx.font = `${fontSize}px ${font}`;
          
          // NEW: Get text background settings
          const textBgColor = textSettings?.backgroundColor || 'transparent';
          const textBgOpacity = textSettings?.backgroundOpacity === undefined ? 0.5 : textSettings.backgroundOpacity;

          // Draw each line of text with stroke and fill
          lines.forEach((line, index) => {
            const lineY = y + (index * lineHeight);
            const textMetrics = ctx.measureText(line);
            const textWidth = textMetrics.width;
            // Note: Actual ascent/descent might be more accurate but this is a common approximation
            const actualTextHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent;
            const bgPadding = fontSize * 0.1;

            // NEW: Draw text background if color is not 'none' or 'transparent'
            if (textBgColor && textBgColor !== 'none' && textBgColor !== 'transparent' && textBgOpacity > 0) {
              ctx.globalAlpha = textBgOpacity;
              ctx.fillStyle = textBgColor;
              let bgX = x;
              if (alignment === 'center') {
                bgX = x - textWidth / 2;
              } else if (alignment === 'right') {
                bgX = x - textWidth;
              }
              // Added some padding to the background
              // const padding = fontSize * 0.1; 
              // ctx.fillRect(bgX - padding, lineY - padding, textWidth + (padding * 2), textHeight + (padding * 2));
              const bgY = lineY - bgPadding; // Since textBaseline is 'top', lineY is the top
              ctx.fillRect(bgX - bgPadding, bgY, textWidth + (bgPadding * 2), actualTextHeight + (bgPadding * 2));
              ctx.globalAlpha = 1; // Reset globalAlpha
            }
            
            // Draw text stroke
            ctx.lineWidth = fontSize * strokeWeight;
            ctx.strokeStyle = color === 'white' ? 'black' : 'white';
            ctx.strokeText(line, x, lineY);
            
            // Draw text fill
            ctx.fillStyle = color;
            ctx.fillText(line, x, lineY);
          });
        }
      } else {
        // Non-cropped mode - original canvas dimensions
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Clear canvas
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw background video if available (non-greenscreen only)
        if (!isGreenscreen && backgroundVideoElement && isBackgroundVideoLoaded) {
          drawBackgroundVideo(ctx, backgroundVideoElement, canvas.width, canvas.height);
        }

        if (isGreenscreen && isBackgroundLoaded) {
          // First draw the background
          ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);
          
          // Create a temporary canvas for the video frame
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d')!;
          tempCanvas.width = targetWidth;
          tempCanvas.height = targetHeight;
          
          // Draw video frame to temp canvas
          tempCtx.drawImage(video, 0, 0, targetWidth, targetHeight);
          
          // Get image data for processing
          const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
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
          
          // Draw processed frame onto main canvas
          // Apply videoVerticalOffset if provided and not in cropped mode
          let finalYOffset = yOffset; // Default yOffset
          if (videoVerticalOffset !== undefined && !isCropped) { // MODIFIED HERE
            const desiredCenterY = (canvasHeight * videoVerticalOffset) / 100;
            const calculatedYOffset = desiredCenterY - (targetHeight / 2);
            // Clamp to ensure video stays within canvas bounds
            finalYOffset = Math.max(0, Math.min(calculatedYOffset, canvasHeight - targetHeight));
          }
          ctx.drawImage(tempCanvas, 0, finalYOffset, targetWidth, targetHeight);
        } else {
          // Regular video drawing
          // Apply videoVerticalOffset if provided and not in cropped mode
          let finalYOffset = yOffset; // Default yOffset
          if (videoVerticalOffset !== undefined && !isCropped) { // MODIFIED HERE
            const desiredCenterY = (canvasHeight * videoVerticalOffset) / 100;
            const calculatedYOffset = desiredCenterY - (targetHeight / 2);
            // Clamp to ensure video stays within canvas bounds
            finalYOffset = Math.max(0, Math.min(calculatedYOffset, canvasHeight - targetHeight));
          }
          ctx.drawImage(video, 0, finalYOffset, targetWidth, targetHeight);
        }
        
        // Draw caption
        if (caption) {
          // Set the caption drawing properties
          ctx.textAlign = 'center' as CanvasTextAlign; // Default to center
          ctx.textBaseline = 'bottom';
          
          // Use defaults if no textSettings provided
          const font = textSettings?.font || 'Impact';
          const size = textSettings?.size || 78;
          const color = textSettings?.color || 'white';
          const strokeWeight = textSettings?.strokeWeight || 0.08;
          const verticalPosition = textSettings?.verticalPosition || 25;
          
          // Configure text alignment
          const alignment = textSettings?.alignment || 'center';
          if (alignment === 'left') ctx.textAlign = 'left';
          else if (alignment === 'right') ctx.textAlign = 'right';
          else ctx.textAlign = 'center';
          
          // Calculate x position based on alignment
          const x = alignment === 'left' ? 40 : (alignment === 'right' ? canvas.width - 40 : canvas.width / 2);
          
          // Calculate y position based on percentage of canvas height
          // This ensures the BOTTOM of the text is at the specified vertical position
          const y = (canvas.height * verticalPosition) / 100;
          
          // Configure text style
          ctx.font = `${size}px ${font}`;
          
          // NEW: Get text background settings for non-cropped mode
          const textBgColorNonCropped = textSettings?.backgroundColor || 'transparent';
          const textBgOpacityNonCropped = textSettings?.backgroundOpacity === undefined ? 0.5 : textSettings.backgroundOpacity;

          // Handle text wrapping
          const maxWidth = canvas.width - 80;
          const lines = wrapText(ctx, caption, maxWidth);
          
          // Calculate the total height of all text lines to properly position multi-line text
          const lineHeightNonCropped = size * 1.1;
          const totalTextHeight = (lines.length - 1) * lineHeightNonCropped;
          
          // Draw each line of text with stroke and fill
          // Adjust position so the BOTTOM of the LAST line is at the specified vertical position
          lines.forEach((line, index) => {
            const lineY = y - (lines.length - 1 - index) * lineHeightNonCropped;
            
            // NEW: Draw text background for non-cropped mode
            const textMetrics = ctx.measureText(line);
            const textWidth = textMetrics.width;
            // const textHeight = size; // Approximation
            const actualTextHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent;
            const bgPadding = size * 0.1;

            if (textBgColorNonCropped && textBgColorNonCropped !== 'none' && textBgColorNonCropped !== 'transparent' && textBgOpacityNonCropped > 0) {
              ctx.globalAlpha = textBgOpacityNonCropped;
              ctx.fillStyle = textBgColorNonCropped;
              let bgX = x;
              if (alignment === 'center') {
                bgX = x - textWidth / 2;
              } else if (alignment === 'right') {
                bgX = x - textWidth;
              }
               // Added some padding to the background
              // const padding = size * 0.1;
              // ctx.fillRect(bgX - padding, lineY - textHeight * 0.8 - padding, textWidth + (padding * 2), textHeight + (padding * 2)); // Adjusted Y for better centering with textBaseline 'bottom'
              // Since textBaseline is 'bottom', lineY is the baseline.
              // The visual top of the text is (lineY - textMetrics.actualBoundingBoxAscent)
              const bgY = (lineY - textMetrics.actualBoundingBoxAscent) - bgPadding;
              ctx.fillRect(bgX - bgPadding, bgY, textWidth + (bgPadding * 2), actualTextHeight + (bgPadding * 2));
              ctx.globalAlpha = 1; // Reset globalAlpha
            }

            // Draw text stroke
            ctx.lineWidth = size * strokeWeight;
            ctx.strokeStyle = color === 'white' ? 'black' : 'white';
            ctx.strokeText(line, x, lineY);
            
            // Draw text fill
            ctx.fillStyle = color;
            ctx.fillText(line, x, lineY);
          });
        }
      }
      
      // Draw custom labels if provided (and not in cropped mode)
      if (labels?.length && !isCropped) {
        labels.forEach(label => {
          if (!label.text.trim()) return;

          // Use custom font and size for label, or fall back to defaults
          const fontSize = label.size;
          ctx.font = `${fontSize}px ${label.font}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Calculate pixel coordinates based on percentage position
          const x = (label.horizontalPosition / 100) * canvas.width;
          const y = (label.verticalPosition / 100) * canvas.height;

          // Calculate approximate label width
          const metrics = ctx.measureText(label.text);
          const textWidth = metrics.width;
          
          // Get background settings from labelSettings, with defaults
          const bgColor = labelSettings?.backgroundColor || 'black';
          const bgOpacity = labelSettings?.backgroundOpacity !== undefined ? labelSettings.backgroundOpacity : 0.5;
          
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
              y - fontSize / 2 - padding / 2,
              textWidth + padding * 2,
              fontSize + padding
            );
          }

          // Set stroke and draw text
          ctx.lineWidth = fontSize * (labelSettings?.strokeWeight || 0.08);
          ctx.strokeStyle = labelSettings?.color === 'black' ? 'white' : 'black';
          ctx.strokeText(label.text, x, y);
          
          // Fill text
          ctx.fillStyle = labelSettings?.color === 'black' ? 'black' : 'white';
          ctx.fillText(label.text, x, y);
        });
      }
      // Draw labels in cropped mode with translated positions
      else if (labels?.length && isCropped) {
        labels.forEach(label => {
          if (!label.text.trim()) return;
          
          // Calculate original position in full canvas
          const originalX = (label.horizontalPosition / 100) * canvasWidth;
          const originalY = (label.verticalPosition / 100) * canvasHeight;
          
          // Check if label is within the video area in the original canvas
          if (originalY >= yOffset && originalY <= (yOffset + targetHeight)) {
            // Calculate the label's position relative to the video
            const relativeY = originalY - yOffset;
            
            // Calculate video top position in cropped canvas
            // Hard-code values to match the calculations done earlier (30px top + text height + 15px gap)
            // Since we can't access those variables directly, recalculate them
            const cropTextTop = 30; // From earlier in the file
            
            // Estimate text height based on caption
            const fontSizeForCaption = textSettings?.size || 78;
            const captionLineHeight = fontSizeForCaption * 1.1;
            const captionLines = wrapText(ctx, caption, canvas.width - 80);
            const captionTextHeight = captionLines.length * captionLineHeight;
            
            // Video starts at: top padding + caption height + gap
            const videoY = cropTextTop + captionTextHeight + 15;
            
            // Translate to new position in cropped canvas
            // New y-position = video's y-position + the label's relative position within video
            const newY = videoY + relativeY;
            
            // Use custom font and size for label, or fall back to defaults
            const fontSize = label.size;
            ctx.font = `${fontSize}px ${label.font}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
  
            // Calculate approximate label width
            const metrics = ctx.measureText(label.text);
            const textWidth = metrics.width;
            
            // Get background settings from labelSettings, with defaults
            const bgColor = labelSettings?.backgroundColor || 'black';
            const bgOpacity = labelSettings?.backgroundOpacity !== undefined ? labelSettings.backgroundOpacity : 0.5;
            
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
                originalX - textWidth / 2 - padding,
                newY - fontSize / 2 - padding / 2,
                textWidth + padding * 2,
                fontSize + padding
              );
            }
  
            // Set stroke and draw text
            ctx.lineWidth = fontSize * (labelSettings?.strokeWeight || 0.08);
            ctx.strokeStyle = labelSettings?.color === 'black' ? 'white' : 'black';
            ctx.strokeText(label.text, originalX, newY);
            
            // Fill text
            ctx.fillStyle = labelSettings?.color === 'black' ? 'black' : 'white';
            ctx.fillText(label.text, originalX, newY);
          }
          // If label is outside the video area, we don't show it in cropped mode
        });
      }

      // <<< Draw Watermark (if enabled) >>>
      if (isWatermarkEnabled && watermarkSettings && watermarkSettings.text) {
        ctx.save(); // Save context state

        const maxWidth = canvas.width - 80;

        ctx.font = `${watermarkSettings.size}px ${watermarkSettings.font}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';

        // <<< Calculate video bounds based on crop state >>>
        let videoRect = {
          x: 0,
          y: 0,
          width: targetWidth, // Use video's intrinsic/drawn dimensions
          height: targetHeight
        };

        if (isCropped && !isGreenscreen) {
          // Calculate cropped video top position
          const fontSize = textSettings?.size || 78;
          const font = textSettings?.font || 'Impact';
          const lineHeight = fontSize * 1.1;
          const captionLines = wrapText(ctx, caption, maxWidth);
          const totalTextHeight = captionLines.length * lineHeight;
          const textTop = 30;
          const textBottom = textTop + totalTextHeight;
          const currentVideoTop = textBottom + 15;

          videoRect.x = 0;
          videoRect.y = currentVideoTop;
        } else {
          // Standard video position
          videoRect.x = 0;
          videoRect.y = yOffset; // Use the standard yOffset
        }

        // <<< Calculate final watermark coords relative to videoRect >>>
        const finalWatermarkX = videoRect.x + (watermarkSettings.horizontalPosition / 100) * videoRect.width;
        const finalWatermarkY = videoRect.y + (watermarkSettings.verticalPosition / 100) * videoRect.height;

        const watermarkX = finalWatermarkX;
        const watermarkY = finalWatermarkY;

        // Use canvas width for wrapping calculation, but limit more strictly
        const watermarkLines = wrapText(ctx, watermarkSettings.text, maxWidth * 0.5); 
        const watermarkLineHeight = watermarkSettings.size * 1.1;

        // Set base opacity
        ctx.globalAlpha = watermarkSettings.opacity;

        // Background
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
        // Text
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

      resolve(canvas);
    };

    video.onloadeddata = () => {
      video.currentTime = 0.1;
    };

    video.onseeked = () => {
      const shouldProcessFrame = !isGreenscreen || (isGreenscreen && isBackgroundLoaded);
      const backgroundVideoReady = !backgroundVideoElement || isBackgroundVideoLoaded;
      
      if (shouldProcessFrame && backgroundVideoReady) {
        processFrame();
      }
    };

    video.onerror = (e) => {
      reject(e);
    };
  });
} 