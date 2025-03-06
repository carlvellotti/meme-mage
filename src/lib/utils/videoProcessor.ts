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

// Add Label interface at the top
interface Label {
  id: string;
  text: string;
  horizontalPosition: number;
  verticalPosition: number;
  size: number;
  font: string;
}

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
  }
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

    // Step 2: Set up canvas with proper dimensions
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d')!;
    container.appendChild(canvas);

    // Step 3: Calculate video dimensions
    const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
    const targetWidth = canvas.width;
    const targetHeight = targetWidth / videoAspect;
    const yOffset = (canvas.height - targetHeight) / 2;

    // Step 4: Create a rendering function
    const renderFrame = () => {
      // Clear canvas with black background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw background if in greenscreen mode
      if (isGreenscreen && backgroundImageElement) {
        ctx.drawImage(backgroundImageElement, 0, 0, canvas.width, canvas.height);
        
        // Process video frame with greenscreen removal
        const processedFrame = processGreenscreen(videoElement, targetWidth, targetHeight);
        ctx.drawImage(processedFrame, 0, yOffset, targetWidth, targetHeight);
      } else {
        // Regular video drawing
        ctx.drawImage(videoElement, 0, yOffset, targetWidth, targetHeight);
      }

      // Draw caption
      drawCaption(ctx, caption, canvas.width, canvas.height, textSettings);
      
      // Draw labels
      if (labels?.length) {
        drawLabels(ctx, labels, canvas.width, canvas.height, labelSettings);
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
        renderFrame();
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
          renderFrame();
          
          // Stop the recorder immediately
          recorder.stop();
          
          // Stop all media
          videoElement.pause();
          audioElement.pause();
          
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
      
      // When video has seeked to the right position
      videoElement.onseeked = () => {
        // Remove event listener to prevent multiple calls
        videoElement.onseeked = null;
        
        // Start recording
        recorder.start(100); // Capture in 100ms chunks for smoother recording
        
        // Start animation frame loop
        animationFrameId = requestAnimationFrame(updateCanvas);
        
        // Play both video and audio in sync
        const playPromises = [
          videoElement.play(),
          audioElement.play()
        ];
        
        // Handle any play errors
        Promise.all(playPromises).catch(error => {
          console.error('Error playing media:', error);
          // Try to continue anyway
        });
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
  textSettings?: TextSettings
) {
  const fontSize = textSettings ? textSettings.size : Math.floor(canvasWidth * 0.078);
  ctx.font = `bold ${fontSize}px ${textSettings?.font || 'Impact'}`;
  ctx.textAlign = textSettings?.alignment || 'center';
  ctx.textBaseline = 'bottom';
  
  const maxWidth = canvasWidth * 0.9;
  const lines = wrapText(ctx, caption, maxWidth);
  const lineHeight = fontSize * 1.2;

  // Calculate vertical position
  const textY = canvasHeight * (textSettings?.verticalPosition || 25) / 100;

  // Calculate x position based on alignment
  const x = textSettings?.alignment === 'left' 
    ? canvasWidth * 0.05 
    : textSettings?.alignment === 'right' 
      ? canvasWidth * 0.95 
      : canvasWidth / 2;

  // Get text color and stroke weight from settings or use defaults
  const textColor = textSettings?.color || 'white';
  const strokeWeight = textSettings?.strokeWeight !== undefined 
    ? fontSize * textSettings.strokeWeight 
    : fontSize * 0.08;

  // Adjust vertical position to account for multiple lines
  // This ensures the BOTTOM of the LAST line is at the specified vertical position
  const totalTextHeight = lineHeight * (lines.length - 1);
  const adjustedTextY = textY - totalTextHeight;

  lines.forEach((line, index) => {
    const y = adjustedTextY + (index * lineHeight);
    
    // Set stroke color to be opposite of text color for better visibility
    ctx.strokeStyle = textColor === 'white' ? '#000000' : '#FFFFFF';
    ctx.lineWidth = strokeWeight;
    ctx.strokeText(line, x, y);
    
    ctx.fillStyle = textColor === 'white' ? '#FFFFFF' : '#000000';
    ctx.fillText(line, x, y);
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
  }
) {
  labels.forEach(label => {
    if (!label.text.trim()) return;
    
    const x = canvasWidth * (label.horizontalPosition / 100);
    const y = canvasHeight * (label.verticalPosition / 100);
    
    // Use label's size and font
    ctx.font = `bold ${label.size}px ${label.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Get text color and stroke weight from global settings
    const textColor = labelSettings?.color || 'white';
    const strokeWeight = labelSettings?.strokeWeight !== undefined 
      ? label.size * labelSettings.strokeWeight 
      : label.size * 0.08;
    
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
