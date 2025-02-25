# Meme Generator Documentation

## System Overview

The meme generator creates memes using AI for template selection and caption generation, supporting both regular video templates and greenscreen videos with background replacement.

## Core Features

### 1. Dual Mode Support
- **Regular Mode**
  - Horizontal video templates (16:9)
  - Single video preview
  - No background processing
  - Optimized for traditional meme formats

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
  verticalPosition: number; // % from top (5-95)
  alignment: 'left' | 'center' | 'right';
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

### 4. Background Image System
- Unsplash API integration with proper attribution
  - Search functionality with debounced queries
  - Pagination support with "Load More"
  - Required attribution format:
    ```html
    Photo by <a href="https://unsplash.com/@username?utm_source=meme_generator&utm_medium=referral">Name</a> on <a href="https://unsplash.com/?utm_source=meme_generator&utm_medium=referral">Unsplash</a>
    ```
  - Download tracking via Unsplash API
  - UTM parameters for proper referral tracking

- Three input methods:
  1. Unsplash search
     - Real-time search with 500ms debounce
     - Grid view with attribution
     - Preview thumbnails
     - Proper photographer credits
  2. File upload (max 5MB)
  3. Direct URL input

- Image handling:
  - Maintains 9:16 aspect ratio
  - Preview thumbnails in grid
  - Full-size images for final render
  - Proper error handling for failed loads

- Attribution display:
  - Overlay on background image
  - Additional credit under preview
  - Links to:
    - Photographer's profile
    - Photo page
    - Unsplash homepage
  - All links include proper UTM tracking

## Technical Implementation

### Component Structure

#### 1. MemeGenerator
- Main controller component
- Handles mode switching and state management
- Coordinates preview updates
- Manages download process

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
  - Proper attribution overlay
  - Download tracking integration
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

### Preview System
- Real-time canvas rendering
- Maintains 9:16 aspect ratio
- Black background default
- Seeks to 0.1s for stable frame
- Handles both video modes appropriately

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
});

// Additional Text
const [labels, setLabels] = useState<Label[]>([]);
```

### Mode Handling
- isGreenscreenMode determines:
  1. Layout structure
  2. Available templates
  3. Processing pipeline
  4. Preview rendering

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
```

### Common Dimensions
- Video preview: 200px width
- Background preview: 200px width
- Modal max-width: xl (32rem)
- Aspect ratios:
  - Regular: 16:9 (aspect-video)
  - Greenscreen: 9:16 (aspect-[9/16])

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

2. Video Processing
   - Seeks to 0.1s for stable frame
   - Uses canvas for efficient rendering
   - Proper cleanup of video elements

3. Background Processing
   - Efficient green screen algorithm
   - Proper memory management
   - Image size limitations

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
   - Animation options
   - More font options
   - Style presets

4. Performance
   - Worker thread processing
   - Caching system
   - Optimized greenscreen algorithm

5. Vector Search Improvements
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

3. UI Changes
   - Maintain consistent spacing
   - Follow existing patterns
   - Test responsive behavior

4. Background Integration
- Always include proper Unsplash attribution
- Implement download tracking
- Use UTM parameters for all links
- Handle image loading states
- Maintain aspect ratio
- Consider mobile performance
- Implement proper error handling

## Testing Checklist

- [ ] Video loading in both modes
- [ ] Background selection and processing
- [ ] Text positioning and styling
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