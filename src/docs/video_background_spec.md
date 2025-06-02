# Video Background Feature Technical Specification

**Date:** 2025-01-25

## Overview

This specification outlines the implementation of a background video feature for non-greenscreen memes. Instead of the current black background, users will be able to select from pre-uploaded background videos that play behind the main meme video at 0.1x speed with blur effects, creating more visually engaging content that performs better on social media algorithms.

## Goals

1. **Enhanced Visual Appeal:** Replace static black backgrounds with dynamic blurred video backgrounds
2. **Social Algorithm Optimization:** Create more engaging content that performs better on platforms
3. **User Control:** Allow users to select from multiple background video options
4. **Performance:** Maintain smooth preview and rendering performance
5. **Consistency:** Ensure identical rendering between preview and final video output

## Scope & Limitations

- **ONLY for Non-Greenscreen Memes:** This feature does not apply to greenscreen templates
- **Pre-uploaded Content:** Background videos will be admin-uploaded, not user-generated
- **Fixed Effects:** 0.1x playback speed and blur effects are standardized

## Current Architecture Analysis

The meme generation system follows a three-layer architecture:

1. **UI Layer (`MemeGenerator.tsx`)** - Manages user inputs and state
2. **Processing Hook (`useVideoProcessing.ts`)** - Coordinates preview and video generation  
3. **Rendering Utilities (`previewGenerator.ts` & `videoProcessor.ts`)** - Handle actual canvas/video rendering

### Current Canvas Rendering Flow

Both preview and video generation follow this sequence:
1. **Canvas Setup** - Standard 1080x1920 dimensions (or dynamic for cropped mode)
2. **Background Drawing** - Currently black fill (`ctx.fillStyle = '#000000'`)
3. **Video Positioning** - Main meme video positioned based on mode and settings
4. **Text Overlay** - Caption, labels, watermarks drawn on top

## Implementation Plan

### 1. Database Schema Changes

**New Table: `background_videos`**

```sql
CREATE TABLE background_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Index for active videos ordered by name
CREATE INDEX IF NOT EXISTS idx_background_videos_active_name ON background_videos(is_active, name) WHERE is_active = true;

-- RLS policies (permissive for now - any authenticated user can manage)
ALTER TABLE background_videos ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active background videos
CREATE POLICY "Users can view active background videos"
ON background_videos
FOR SELECT
USING (is_active = true);

-- All authenticated users can insert background videos
CREATE POLICY "Authenticated users can insert background videos"
ON background_videos
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- All authenticated users can update background videos
CREATE POLICY "Authenticated users can update background videos"
ON background_videos
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- All authenticated users can delete background videos
CREATE POLICY "Authenticated users can delete background videos"
ON background_videos
FOR DELETE
USING (auth.uid() IS NOT NULL);
```

**Database Fields:**
- `id`: Unique identifier
- `name`: Display name for UI (e.g., "Sunset Vibes", "City Lights")
- `video_url`: URL to the background video file in Supabase Storage
- `thumbnail_url`: URL to thumbnail image for UI preview
- `created_at`: Creation timestamp
- `is_active`: Boolean to enable/disable backgrounds

### 2. TypeScript Type Definitions

**Add to `src/lib/types/meme.ts`:**

```typescript
export interface BackgroundVideo {
  id: string;
  name: string;
  video_url: string;
  thumbnail_url?: string | null;
  created_at?: string;
  is_active?: boolean;
}
```

**Update `src/lib/supabase/types.ts`:**

```typescript
export interface Database {
  public: {
    Tables: {
      // ... existing tables
      background_videos: {
        Row: BackgroundVideo;
        Insert: Omit<BackgroundVideo, 'id' | 'created_at'>;
        Update: Partial<Omit<BackgroundVideo, 'id' | 'created_at'>>;
      };
    };
  };
}
```

### 3. Backend API Implementation

**New API Route: `src/app/api/background-videos/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('background_videos')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ backgroundVideos: data || [] });
  } catch (error: any) {
    console.error('Error fetching background videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch background videos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, video_url, thumbnail_url } = body;

    if (!name || !video_url) {
      return NextResponse.json(
        { error: 'Name and video_url are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('background_videos')
      .insert({
        name,
        video_url,
        thumbnail_url,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ backgroundVideo: data }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating background video:', error);
    return NextResponse.json(
      { error: 'Failed to create background video' },
      { status: 500 }
    );
  }
}
```

### 4. State Management Updates

**Update `MemeGenerator.tsx`:**

```typescript
// Add new state variables
const [selectedBackgroundVideo, setSelectedBackgroundVideo] = useState<BackgroundVideo | null>(null);
const [backgroundVideos, setBackgroundVideos] = useState<BackgroundVideo[]>([]);
const [isLoadingBackgroundVideos, setIsLoadingBackgroundVideos] = useState(false);

// Add to createPreviewParams function
const createPreviewParams = useCallback((): GeneratePreviewParams | null => {
  if (!selectedTemplate) return null;
  return {
    videoUrl: selectedTemplate.video_url,
    caption,
    backgroundUrl: selectedBackground?.url,
    backgroundVideoUrl: selectedBackgroundVideo?.video_url, // NEW
    isGreenscreenMode,
    textSettings,
    labels,
    labelSettings,
    isCropped,
    isWatermarkEnabled,
    watermarkSettings,
    videoVerticalOffset: isCropped ? undefined : videoVerticalOffset,
  };
}, [
  selectedTemplate, 
  caption, 
  selectedBackground, 
  selectedBackgroundVideo, // NEW
  isGreenscreenMode, 
  textSettings, 
  labels, 
  labelSettings, 
  isCropped, 
  isWatermarkEnabled, 
  watermarkSettings, 
  videoVerticalOffset
]);

// Add useEffect to load background videos for non-greenscreen mode
useEffect(() => {
  async function loadBackgroundVideos() {
    if (isGreenscreenMode) return; // Only for non-greenscreen
    
    setIsLoadingBackgroundVideos(true);
    try {
      const response = await fetch('/api/background-videos');
      const data = await response.json();
      if (data.backgroundVideos) {
        setBackgroundVideos(data.backgroundVideos);
      }
    } catch (error) {
      console.error('Error loading background videos:', error);
      toast.error('Failed to load background videos');
    } finally {
      setIsLoadingBackgroundVideos(false);
    }
  }

  loadBackgroundVideos();
}, [isGreenscreenMode]);
```

### 5. UI Component Implementation

**New Component: `src/app/components/MemeGenerator/BackgroundVideoSelector.tsx`**

```typescript
import React from 'react';
import { BackgroundVideo } from '@/lib/types/meme';

interface BackgroundVideoSelectorProps {
  selectedBackgroundVideo: BackgroundVideo | null;
  backgroundVideos: BackgroundVideo[];
  onSelect: (video: BackgroundVideo | null) => void;
  isLoading: boolean;
  disabled?: boolean;
}

const BackgroundVideoSelector: React.FC<BackgroundVideoSelectorProps> = ({
  selectedBackgroundVideo,
  backgroundVideos,
  onSelect,
  isLoading,
  disabled = false
}) => {
  return (
    <div className="space-y-2">
      <label htmlFor="backgroundVideo" className="block text-sm font-medium text-gray-300">
        Background Video (Optional)
      </label>
      
      {isLoading ? (
        <div className="text-sm text-gray-400">Loading background videos...</div>
      ) : (
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
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
        >
          <option value="">None (Black Background)</option>
          {backgroundVideos.map((video) => (
            <option key={video.id} value={video.id}>
              {video.name}
            </option>
          ))}
        </select>
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
```

**Integration in `MemeGenerator.tsx`:**

```typescript
// Import the new component
import BackgroundVideoSelector from './MemeGenerator/BackgroundVideoSelector';

// Add to the editor section (only for non-greenscreen mode)
{!isGreenscreenMode && (
  <BackgroundVideoSelector
    selectedBackgroundVideo={selectedBackgroundVideo}
    backgroundVideos={backgroundVideos}
    onSelect={setSelectedBackgroundVideo}
    isLoading={isLoadingBackgroundVideos}
    disabled={isGreenscreenMode}
  />
)}
```

### 6. Parameter Flow Updates

**Update Shared Interfaces in `useVideoProcessing.ts`:**

```typescript
interface VideoProcessingBaseParams {
  videoUrl: string;
  caption: string;
  backgroundUrl?: string;
  backgroundVideoUrl?: string; // NEW
  isGreenscreenMode: boolean;
  textSettings: TextSettings;
  labels: Label[];
  labelSettings: CommonLabelSettings;
  isCropped: boolean;
  isWatermarkEnabled: boolean;
  watermarkSettings: WatermarkSettings;
  videoVerticalOffset?: number;
}
```

**Update Function Calls:**

```typescript
// In generatePreview
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
  params.backgroundVideoUrl // NEW
);

// In processAndDownloadMeme
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
  params.backgroundVideoUrl // NEW
);
```

### 7. Rendering Pipeline Implementation

**Update Function Signatures:**

**`src/lib/utils/previewGenerator.ts`:**

```typescript
export async function createMemePreview(
  videoUrl: string,
  caption: string,
  backgroundImage?: string,
  isGreenscreen?: boolean,
  textSettings?: TextSettings,
  labels?: Label[],
  labelSettings?: {...},
  isCropped?: boolean,
  isWatermarkEnabled?: boolean,
  watermarkSettings?: WatermarkSettings,
  videoVerticalOffset?: number,
  backgroundVideoUrl?: string // NEW
): Promise<HTMLCanvasElement>
```

**`src/lib/utils/videoProcessor.ts`:**

```typescript
export async function createMemeVideo(
  videoUrl: string,
  caption: string,
  backgroundImage?: string,
  isGreenscreen?: boolean,
  textSettings?: TextSettings,
  labels?: Label[],
  labelSettings?: {...},
  isCropped?: boolean,
  isWatermarkEnabled?: boolean,
  watermarkSettings?: WatermarkSettings,
  videoVerticalOffset?: number,
  backgroundVideoUrl?: string // NEW
): Promise<Blob>
```

### 8. Background Video Processing Implementation

**New Helper Function (add to both files):**

```typescript
// Load background video helper
async function loadBackgroundVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.loop = true;
    video.playbackRate = 0.1; // Slow motion effect
    
    video.onloadeddata = () => {
      video.currentTime = 0;
      resolve(video);
    };
    
    video.onerror = (e) => reject(e);
    video.src = url;
  });
}

// Draw background video with effects
function drawBackgroundVideo(
  ctx: CanvasRenderingContext2D, 
  backgroundVideo: HTMLVideoElement, 
  canvasWidth: number, 
  canvasHeight: number
) {
  // Save current context state
  ctx.save();
  
  // Apply blur filter
  ctx.filter = 'blur(8px)';
  
  // Calculate scaling to fill canvas (crop if necessary)
  const videoAspect = backgroundVideo.videoWidth / backgroundVideo.videoHeight;
  const canvasAspect = canvasWidth / canvasHeight;
  
  let drawWidth, drawHeight, drawX, drawY;
  
  if (videoAspect > canvasAspect) {
    // Video is wider - fit to height, crop width
    drawHeight = canvasHeight;
    drawWidth = drawHeight * videoAspect;
    drawX = (canvasWidth - drawWidth) / 2;
    drawY = 0;
  } else {
    // Video is taller - fit to width, crop height
    drawWidth = canvasWidth;
    drawHeight = drawWidth / videoAspect;
    drawX = 0;
    drawY = (canvasHeight - drawHeight) / 2;
  }
  
  // Draw the background video
  ctx.drawImage(backgroundVideo, drawX, drawY, drawWidth, drawHeight);
  
  // Restore context state (removes filter)
  ctx.restore();
}
```

### 9. Integration in Rendering Functions

**Update `previewGenerator.ts` processFrame function:**

```typescript
// Inside processFrame function, after canvas setup and before video drawing

// Load background video if specified (non-greenscreen only)
let backgroundVideoElement = null;
if (!isGreenscreen && backgroundVideoUrl) {
  try {
    backgroundVideoElement = await loadBackgroundVideo(backgroundVideoUrl);
  } catch (error) {
    console.warn('Failed to load background video:', error);
  }
}

// In the rendering section, replace black background fill:
// OLD:
// ctx.fillStyle = '#000000';
// ctx.fillRect(0, 0, canvas.width, canvas.height);

// NEW:
ctx.fillStyle = '#000000';
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Draw background video if available (non-greenscreen only)
if (!isGreenscreen && backgroundVideoElement) {
  drawBackgroundVideo(ctx, backgroundVideoElement, canvas.width, canvas.height);
}
```

**Update `videoProcessor.ts` renderFrame function:**

```typescript
// Before the video processing starts, load background video
let backgroundVideoElement = null;
if (!isGreenscreen && backgroundVideoUrl) {
  try {
    backgroundVideoElement = await loadBackgroundVideo(backgroundVideoUrl);
    container.appendChild(backgroundVideoElement);
  } catch (error) {
    console.warn('Failed to load background video:', error);
  }
}

// In renderFrame function:
const renderFrame = (watermarkEnabled: boolean, currentWatermarkSettings: WatermarkSettings | undefined) => {
  // Clear canvas with black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw background video if available (non-greenscreen only)
  if (!isGreenscreen && backgroundVideoElement) {
    drawBackgroundVideo(ctx, backgroundVideoElement, canvas.width, canvas.height);
  }

  // ... rest of existing rendering logic
};

// Start background video when main video starts
if (backgroundVideoElement) {
  backgroundVideoElement.currentTime = 0.1;
  backgroundVideoElement.onseeked = () => {
    backgroundVideoElement.play().catch(console.error);
  };
}

// Stop background video when recording stops
// Add to cleanup section
if (backgroundVideoElement) {
  backgroundVideoElement.pause();
}
```

### 10. Performance and Resource Management

**Video Element Lifecycle:**

```typescript
// In both preview and video generation, ensure proper cleanup
const cleanup = () => {
  if (backgroundVideoElement) {
    backgroundVideoElement.pause();
    backgroundVideoElement.removeAttribute('src');
    backgroundVideoElement.load();
    if (backgroundVideoElement.parentNode) {
      backgroundVideoElement.parentNode.removeChild(backgroundVideoElement);
    }
  }
  // ... existing cleanup logic
};

// Call cleanup on component unmount and error states
```

**Memory Management:**
- Load background videos on demand only
- Cache loaded video elements in component state to avoid reloading
- Proper cleanup when switching background videos
- Handle loading states and errors gracefully

### 11. Error Handling

**Loading States:**
- Show loading indicator while fetching background videos from API
- Graceful fallback to black background if video fails to load
- Toast notifications for user feedback on errors

**Fallback Behavior:**
- If background video fails to load, continue with black background
- Log warnings for debugging but don't break the meme generation flow
- Retry mechanism for transient network errors

### 12. Testing Strategy

**Unit Testing:**
- Test background video loading function
- Test video scaling calculations
- Test blur effect application

**Integration Testing:**
- Test complete flow from UI selection to final video
- Verify consistency between preview and downloaded video
- Test performance with various video sizes

**User Acceptance Testing:**
- Test with different background videos
- Verify visual quality of blur effects
- Confirm 0.1x speed is appropriate
- Test switching between different backgrounds

### 13. Future Enhancements

**Phase 2 Features:**
- Admin interface for uploading new background videos
- User-adjustable blur intensity
- Variable playback speeds
- Video upload validation and optimization
- Thumbnail generation automation

**Performance Optimizations:**
- Video preloading strategies
- WebGL-based rendering for better performance
- Background video compression optimization

## Implementation Sequence

### Phase 1: Core Infrastructure
1. **Database Setup** - Create background_videos table and migrate
2. **API Endpoint** - Implement /api/background-videos route
3. **Type Definitions** - Add BackgroundVideo interface

### Phase 2: UI Implementation  
4. **Component Creation** - Build BackgroundVideoSelector component
5. **State Integration** - Add state management to MemeGenerator
6. **UI Integration** - Add selector to canvas controls

### Phase 3: Rendering Engine
7. **Parameter Flow** - Update all function signatures and interfaces
8. **Helper Functions** - Implement background video loading and drawing
9. **Preview Integration** - Modify previewGenerator.ts
10. **Video Integration** - Modify videoProcessor.ts

### Phase 4: Testing & Polish
11. **Error Handling** - Implement proper error handling and fallbacks
12. **Performance Testing** - Verify smooth operation with background videos
13. **Consistency Validation** - Ensure preview matches final video
14. **Admin Seeding** - Upload initial set of background videos

## Technical Advantages

1. **Consistent Architecture:** Leverages existing parameter-passing system
2. **Non-Breaking Changes:** Only adds optional parameters to existing functions
3. **Performance Optimized:** Background videos load only when needed
4. **Proper Separation:** Maintains clean separation between UI, processing, and rendering
5. **Future-Extensible:** Easy to add more background effects or user customization
6. **Resource Efficient:** Proper cleanup and memory management

## Risks and Mitigations

**Performance Risks:**
- Multiple video elements could impact performance
- *Mitigation:* Lazy loading, proper cleanup, performance monitoring

**Browser Compatibility:**
- Canvas filter support varies across browsers
- *Mitigation:* Feature detection and graceful fallbacks

**User Experience:**
- Background videos might be distracting
- *Mitigation:* Careful curation of background content, user testing

**Resource Usage:**
- Background videos increase bandwidth and storage
- *Mitigation:* Video compression, CDN usage, selective loading

This specification provides a comprehensive roadmap for implementing the background video feature while maintaining the robustness and consistency of the existing meme generation system.
