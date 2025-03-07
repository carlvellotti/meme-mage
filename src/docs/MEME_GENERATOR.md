# Meme Mage Documentation

## System Overview

The meme generator creates memes using AI for template selection and caption generation, supporting both regular video templates and greenscreen videos with background replacement.

## Core Features

### 1. Dual Mode Support
- **Regular Mode**
  - Horizontal video templates (16:9)
  - Single video preview
  - No background processing
  - Optimized for traditional meme formats
  - Supports crop feature for compact format

- **Greenscreen Mode**
  - Vertical video templates (9:16)
  - Background image selection via Unsplash
  - Real-time greenscreen removal
  - Side-by-side video and background preview

### 2. AI Integration
- Template selection based on user's idea
- Audience-aware caption generation
- Multiple template and caption options
- Vector similarity search for relevant templates

### 3. Crop Functionality
- **Purpose**: Creates more compact videos optimized for platforms beyond TikTok/Instagram
- **Activation**: Toggle button next to Preview text
- **Behavior**:
  - Only available for non-greenscreen videos
  - Locks caption position (not moveable in crop mode)
  - Maintains label positioning relative to video content
  - Crops canvas to minimal necessary size
- **Specifications**:
  - 30px padding above text
  - 15px gap between text and video
  - 15px padding below video
  - Maintains original width (1080px)
- **Implementation**:
  - Calculates optimal dimensions based on text height and video size
  - Translates label positions to maintain relative placement
  - Ensures consistent rendering between preview and downloaded video
  - Reset to uncropped state when new caption selected

## Vector Similarity Search Implementation

### Overview
The meme generator uses vector embeddings and similarity search to find the most relevant templates for a user's prompt. This system enables semantic understanding beyond simple keyword matching.

### How It Works
1. **Embedding Generation**:
   - User prompts are converted to vector embeddings using OpenAI's `text-embedding-3-small` model
   - Each embedding is a 1536-dimensional vector representing the semantic meaning of the text
   - Template descriptions are also converted to embeddings during template creation/update

2. **Storage**:
   - Embeddings are stored in the Supabase `meme_templates` table
   - Uses the `pgvector` extension for vector operations
   - Embeddings are stored as string representations of arrays

3. **Similarity Calculation**:
   - Uses cosine similarity to measure the semantic closeness between vectors
   - The `cosineSimilarity` function handles both array and string-formatted embeddings
   - Higher similarity scores (closer to 1.0) indicate better matches

4. **Search Process**:
   - When a user enters a prompt, it's converted to an embedding
   - The system queries Supabase using a custom SQL function `match_meme_templates`
   - The function finds templates with embeddings most similar to the prompt
   - Results are ordered by similarity and filtered by greenscreen mode

5. **SQL Implementation**:
   ```sql
   CREATE FUNCTION match_meme_templates(
     query_embedding vector(1536),
     match_threshold float,
     match_count int,
     is_greenscreen_filter boolean
   )
   RETURNS TABLE (
     id uuid,
     name text,
     video_url text,
     instructions text,
     similarity float
   )
   LANGUAGE SQL
   AS $$
     SELECT 
       meme_templates.id,
       meme_templates.name,
       meme_templates.video_url,
       meme_templates.instructions,
       1 - (meme_templates.embedding <=> query_embedding) as similarity
     FROM meme_templates
     WHERE 
       embedding IS NOT NULL AND
       is_greenscreen = is_greenscreen_filter
     ORDER BY embedding <=> query_embedding
     LIMIT match_count;
   $$;
   ```

6. **Fallback Mechanism**:
   - If no templates are found via vector search, the system falls back to a default selection
   - This ensures users always get template options even for unusual prompts

### Implementation Notes
- The `<=>` operator is PostgreSQL's vector distance operator
- We use `1 - distance` to convert distance to similarity (0 to 1 scale)
- The system returns the top 5 most similar templates by default
- Embeddings must be properly formatted as arrays for similarity calculation

### Troubleshooting
- If similarity search returns no results, check:
  1. Embedding format in the database (should be parseable as arrays)
  2. The SQL function parameters and implementation
  3. The embedding generation process
  4. The cosine similarity calculation

### 3. Text System
#### Caption Settings
```typescript
interface TextSettings {
  size: number;        // Font size (40-120)
  font: string;        // Font family
  verticalPosition: number; // % from top (2-95)
  alignment: 'left' | 'center' | 'right';
  color: 'white' | 'black';  // Text color
  strokeWeight: number;      // Stroke weight as multiplier of font size
}
```

#### Label System
```typescript
interface Label {
  id: string;
  text: string;
  horizontalPosition: number; // % from left (0-100)
  verticalPosition: number;   // % from top (0-100)
  size: number;              // Font size (40-120)
  font: string;              // Font family
}
```

#### Global Label Settings
```typescript
interface LabelSettings {
  font: string;              // Font family for all labels
  size: number;              // Font size for all labels (40-120)
  color: 'white' | 'black';  // Text color for all labels
  strokeWeight: number;      // Stroke weight as multiplier of font size
  backgroundColor: 'black' | 'white' | 'transparent'; // Background color for all labels
  backgroundOpacity: number; // Background opacity (0.1-1.0) for all labels
}
```

#### Label Background Options
- **Color Options**:
  - Black: High contrast on light backgrounds
  - White: High contrast on dark backgrounds
  - Transparent: No background, just text and stroke
- **Opacity Control**:
  - Adjustable from 10% to 100%
  - Only available when a non-transparent background is selected
  - Provides fine-tuning for visibility vs. obtrusiveness
- **Implementation**:
  - Uses RGBA color values for proper transparency
  - Renders a slightly padded rectangle behind each label
  - Applies consistently in both regular and cropped mode
  - Maintains proper z-indexing with text

### 4. Background Image System
- Unsplash API integration with proper attribution
  - Search functionality with debounced queries
  - Pagination support with "Load More"
  - Enhanced attribution system:
    - Instagram handle inclusion when available
    - Fallback to Unsplash username when Instagram unavailable
    - Clean UI with proper z-index stacking (preview above attribution)
    - Copyable attribution text with proper format
  - Required attribution format:
    ```html
    Photo by <a href="https://unsplash.com/@username?utm_source=meme_mage&utm_medium=referral">Name</a> on <a href="https://unsplash.com/?utm_source=meme_mage&utm_medium=referral">Unsplash</a>
    ```
  - Download tracking via Unsplash API
  - UTM parameters for proper referral tracking

- Three input methods:
  1. Unsplash search
     - Real-time search with 500ms debounce
     - Clean grid view without distracting attribution overlay
     - Preview thumbnails
     - Proper photographer credits in MemeGenerator component
  2. File upload (max 5MB)
  3. Direct URL input

- Image handling:
  - Maintains 9:16 aspect ratio
  - Preview thumbnails in grid
  - Full-size images for final render
  - Proper error handling for failed loads

- Attribution display:
  - Simplified visible attribution display: "Background by [Name] on Unsplash"
  - Comprehensive copyable attribution text:
    - With Instagram: "Photo by [Name] on Unsplash. Instagram: @[instagram_handle]"
    - Without Instagram: "Photo by [Name] on Unsplash. Unsplash: @[username]"
  - Only shown for Unsplash images (conditional rendering)
  - Positioned behind preview with z-index management
  - Stronger attribution language: "You must credit the photographer when sharing:"

## Technical Implementation

### Component Structure

#### 1. MemeGenerator
- Main controller component
- Handles mode switching and state management
- Coordinates preview updates
- Manages download process
- Controls crop functionality
- Handles label background settings

#### 2. ImagePicker
- Modal component for all background image selection methods
- Three tabs:
  1. Unsplash Search
     - Integrated search with debounced queries
     - Grid view with attribution
     - Load more pagination
  2. File Upload
     - Drag and drop support
     - 5MB size limit
     - Image file validation
  3. Link Input
     - Direct URL input
     - URL validation
- Handles all image processing and validation
- Responsive grid layout
- Used in non-greenscreen mode

#### 3. UnsplashPicker
- Specialized component for Unsplash-only image selection
- Used within greenscreen mode
- Features:
  - Full-width search interface
  - Real-time search with debounce
  - Clean thumbnail display (no attribution overlay)
  - Download tracking integration
  - Social media data capture (Instagram, Twitter)
  - UTM parameter handling
- Direct integration with Unsplash API
- Used in greenscreen mode for background selection

#### 4. AIMemeSelector
- Initial search interface
- Mode selection (Regular/Greenscreen)
- Template and caption generation
- Results display and selection
- Integrates with vector similarity search via API calls to `/api/meme-selection`
- Handles template selection and caption generation

### Video Processing

#### Regular Mode
```typescript
// Video dimensions and positioning
const videoAspect = video.videoWidth / video.videoHeight;
const targetWidth = canvas.width;
const targetHeight = targetWidth / videoAspect;
```

#### Greenscreen Mode
```typescript
// Green removal threshold
if (g > 100 && g > 1.4 * r && g > 1.4 * b) {
  pixels[i + 3] = 0; // Make pixel transparent
}
```

#### Crop Mode
```typescript
// Calculate cropped dimensions
const textTop = 30; // 30px padding above text
const textBottom = textTop + totalTextHeight;
const videoTop = textBottom + 15; // 15px gap between text and video
const newHeight = videoTop + targetHeight + 15; // 15px bottom padding

// Set dimensions for cropped output
canvas.width = standardWidth; // Maintain original width
canvas.height = newHeight; // Adjust height to fit content only

// Position video below text with gap
ctx.drawImage(video, 0, videoTop, targetWidth, targetHeight);
```

### Label Position Translation (Crop Mode)
```typescript
// Calculate original position in full canvas
const originalX = (label.horizontalPosition / 100) * standardWidth;
const originalY = (label.verticalPosition / 100) * standardHeight;

// Only display labels that were originally within the video area
if (originalY >= yOffset && originalY <= (yOffset + targetHeight)) {
  // Calculate position relative to video
  const relativeY = originalY - yOffset;
  
  // Translate to new position in cropped canvas
  const newY = videoY + relativeY;
  
  // Draw label at translated position
  ctx.strokeText(label.text, originalX, newY);
  ctx.fillText(label.text, originalX, newY);
}
```

### Text Rendering
```typescript
// Caption rendering with customizable color and stroke
const textColor = textSettings?.color || 'white';
const strokeWeight = textSettings?.strokeWeight !== undefined 
  ? fontSize * textSettings.strokeWeight 
  : fontSize * 0.08;

// Set stroke color to be opposite of text color for better visibility
ctx.strokeStyle = textColor === 'white' ? '#000000' : '#FFFFFF';
ctx.lineWidth = strokeWeight;
ctx.strokeText(line, x, y);

ctx.fillStyle = textColor === 'white' ? '#FFFFFF' : '#000000';
ctx.fillText(line, x, y);
```

### Label Background Rendering
```typescript
// Get background settings
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
```

### Preview System
- Real-time canvas rendering
- Maintains 9:16 aspect ratio in regular mode
- Dynamic height in crop mode
- Black background default
- Seeks to 0.1s for stable frame
- Handles both video modes appropriately
- Special handling for previewing cropped videos

## State Management

### Key States
```typescript
// Template Selection
const [selectedTemplate, setSelectedTemplate] = useState<MemeTemplate | null>(null);

// Background Management
const [selectedBackground, setSelectedBackground] = useState<BackgroundImage | null>(null);

// Text Configuration
const [textSettings, setTextSettings] = useState<TextSettings>({
  size: 78,
  font: 'Impact',
  verticalPosition: 25,
  alignment: 'center',
  color: 'white',
  strokeWeight: 0.08,
});

// Label Configuration
const [labelSettings, setLabelSettings] = useState({
  font: 'Impact',
  size: 78,
  color: 'white',
  strokeWeight: 0.08,
  backgroundColor: 'black',
  backgroundOpacity: 0.5,
});

// Additional Text
const [labels, setLabels] = useState<Label[]>([]);

// Crop Mode
const [isCropped, setIsCropped] = useState(false);
```

### Mode Handling
- isGreenscreenMode determines:
  1. Layout structure
  2. Available templates
  3. Processing pipeline
  4. Preview rendering
  5. Crop functionality availability (only in non-greenscreen mode)

- isCropped determines:
  1. Canvas dimensions
  2. Text positioning behavior (locked in crop mode)
  3. Video positioning
  4. Label translation

## API Integration

### 1. Unsplash API
```typescript
// Search endpoint
interface UnsplashSearchParams {
  query: string;
  page: number;
  per_page: number;
  orientation: 'portrait';
}

// Image response structure
interface UnsplashImage {
  id: string;
  urls: {
    regular: string;
    small: string;
  };
  user: {
    name: string;
    username: string;
    links: {
      html: string;
    };
  };
  links: {
    html: string;
  };
}

// Background image structure
interface BackgroundImage {
  id: string;
  name: string;
  url: string;
  attribution?: {
    photographerName: string;
    photographerUrl: string;
    photoUrl: string;
    username: string;
    instagram_username: string | null;
  };
}
```

### 2. AI Template Selection
```typescript
interface TemplateQuery {
  prompt: string;
  isGreenscreenMode: boolean;
}
```

## Styling System

### Layout Variants
```typescript
// Greenscreen Mode Layout
<div className="flex gap-4">
  <div className="w-[200px] flex-shrink-0">
    {/* Video preview */}
  </div>
  <div className="w-[200px] flex-shrink-0">
    {/* Background selector */}
  </div>
</div>

// Regular Mode Layout
<div>
  <video className="w-full aspect-video" />
</div>

// Crop Button
<button
  onClick={toggleCrop}
  className={`text-sm px-3 py-1 rounded-full ${
    isCropped 
      ? 'bg-blue-600 text-white hover:bg-blue-700' 
      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
  }`}
>
  {isCropped ? 'Uncrop' : 'Crop'}
</button>

// Label Background Options
<div className="flex gap-0 border rounded-md overflow-hidden">
  <button
    onClick={() => updateLabelSetting('backgroundColor', 'black')}
    className={`flex-1 p-2 text-sm font-bold text-white bg-black`}
  >
    Black
  </button>
  <button
    onClick={() => updateLabelSetting('backgroundColor', 'white')}
    className={`flex-1 p-2 text-sm font-bold text-black bg-white`}
  >
    White
  </button>
  <button
    onClick={() => updateLabelSetting('backgroundColor', 'transparent')}
    className={`flex-1 p-2 text-sm font-bold text-white bg-gray-700`}
  >
    None
  </button>
</div>
```

### Common Dimensions
- Video preview: 200px width
- Background preview: 200px width
- Modal max-width: xl (32rem)
- Aspect ratios:
  - Regular: 16:9 (aspect-video)
  - Greenscreen: 9:16 (aspect-[9/16])
  - Cropped: dynamic height based on content

## Error Handling

### Common Issues
1. Video Loading
```typescript
video.onerror = (e) => {
  reject(e);
  toast.error('Failed to load video');
};
```

2. Background Processing
```typescript
if (file.size > 5 * 1024 * 1024) {
  toast.error('File size must be less than 5MB');
  return;
}
```

3. Preview Generation
```typescript
try {
  const canvas = await createMemePreview(/*...*/);
  setPreviewCanvas(canvas);
} catch (error) {
  toast.error('Failed to generate preview');
}
```

## Performance Considerations

1. Preview Generation
   - Uses requestAnimationFrame for smooth updates
   - Debounced search for Unsplash
   - Optimized image loading with proper dimensions
   - Canvas recreation for crop mode changes

2. Video Processing
   - Seeks to 0.1s for stable frame
   - Uses canvas for efficient rendering
   - Proper cleanup of video elements
   - Dynamic canvas sizing for crop mode

3. Background Processing
   - Efficient green screen algorithm
   - Proper memory management
   - Image size limitations

4. Label Processing
   - Efficient position translation in crop mode
   - Only renders labels that fall within video area
   - Conditional background rendering

## Future Improvements

1. Template Management
   - Categories and tags
   - User favorites
   - Usage analytics

2. Background Features
   - Custom color removal
   - Multiple background layers
   - Animation support

3. Text Enhancements
   - More color options beyond black/white
   - Gradient text support
   - Animation options
   - More font options
   - Style presets

4. Crop Enhancements
   - Custom crop area selection
   - Preset aspect ratios (1:1, 4:5, etc.)
   - Custom padding options

5. Label Enhancements
   - Additional background shapes (rounded rectangle, pill, etc.)
   - Custom background colors beyond black/white
   - Gradient backgrounds
   - Drop shadows and other effects

6. Performance
   - Worker thread processing
   - Caching system
   - Optimized greenscreen algorithm
   - Improved label position translation

7. Vector Search Improvements
   - Better template descriptions for more accurate embeddings
   - Improved embedding storage format (native arrays)
   - Fine-tuned similarity thresholds for different use cases
   - Periodic reindexing of embeddings with newer models

## Development Guidelines

1. Adding Templates
   - Ensure proper aspect ratio
   - Test in both modes
   - Include usage instructions
   - Write detailed descriptions for better vector matching
   - Generate embeddings for all new templates

2. Modifying Processing
   - Test with various video types
   - Verify memory usage
   - Check mobile performance
   - Test with and without crop feature

3. UI Changes
   - Maintain consistent spacing
   - Follow existing patterns
   - Test responsive behavior
   - Ensure crop toggle button visibility

4. Background Integration
   - Always include proper Unsplash attribution
   - Implement download tracking
   - Use UTM parameters for all links
   - Handle image loading states
   - Maintain aspect ratio
   - Consider mobile performance
   - Implement proper error handling

5. Label Enhancements
   - Maintain consistent styling paradigms
   - Test in both regular and crop modes
   - Ensure background colors work in diverse contexts
   - Consider high-contrast options for accessibility

## Testing Checklist

- [ ] Video loading in both modes
- [ ] Background selection and processing
- [ ] Text positioning and styling
- [ ] Text color and stroke weight customization
- [ ] Label positioning and styling
- [ ] Label background color and opacity customization
- [ ] Crop functionality
  - [ ] Initial selection
  - [ ] Text positioning above video
  - [ ] Proper dimension calculation
  - [ ] Label positioning translation
  - [ ] Reset on new caption selection
- [ ] Preview generation
- [ ] Download functionality
- [ ] Error handling
- [ ] Mobile responsiveness
- [ ] Performance metrics
- [ ] Vector similarity search accuracy

Additional checks:
- [ ] Unsplash search functionality
- [ ] Attribution display
- [ ] Download tracking
- [ ] UTM parameters
- [ ] Image loading states
- [ ] Error handling
- [ ] Mobile responsiveness
- [ ] Background removal preview