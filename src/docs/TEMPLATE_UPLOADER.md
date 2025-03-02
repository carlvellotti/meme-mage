# Template Uploader Documentation

## Overview

The Template Uploader is a core component of the Meme Mage platform that allows for the creation and storage of new meme templates. It features an AI-enhanced description system that automatically generates detailed, structured descriptions of meme templates to improve template searchability and usability.

## Key Features

1. **Video Upload System**
   - Drag-and-drop interface
   - File input selection
   - Preview functionality
   - Format validation

2. **Template Metadata Management**
   - Template naming
   - Detailed descriptions
   - Greenscreen flag for templates using chroma key

3. **AI Enhancement System**
   - AI-powered description generation using Claude 3.7 Sonnet
   - Image pasting for improved context
   - Markdown-formatted detailed template analysis
   - Auto-expanding textarea for readability

4. **Database Integration**
   - Supabase storage for video files
   - Embedding generation for vector search
   - Structured database entry creation

## Component Structure

### State Management

```typescript
// Core form state
const [templateName, setTemplateName] = useState('')
const [templateExplanation, setTemplateExplanation] = useState('')
const [file, setFile] = useState<File | null>(null)
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
const [preview, setPreview] = useState('')

// UI state
const [isDragging, setIsDragging] = useState(false)
const [isGreenscreen, setIsGreenscreen] = useState(false)

// AI enhancement state
const [pastedImages, setPastedImages] = useState<string[]>([])
const [isEnhancing, setIsEnhancing] = useState(false)

// Ref for auto-expanding textarea
const textareaRef = useRef<HTMLTextAreaElement>(null)
```

### Core Functions

#### 1. Form Submission

The `handleSubmit` function processes the form submission:
- Validates required fields
- Uploads video to Supabase storage
- Gets a public URL for the video
- Generates text embeddings for vector search
- Creates a database entry with all metadata
- Resets the form on successful submission

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setLoading(true)
  setError(null)

  try {
    // File validation
    if (!file) {
      throw new Error('Please select a video file')
    }

    // File upload to Supabase
    const filename = `${Date.now()}-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('meme-templates')
      .upload(filename, file)

    if (uploadError) throw uploadError

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('meme-templates')
      .getPublicUrl(uploadData.path)

    // Generate embedding from template text
    const textForEmbedding = `${templateName}. ${templateExplanation}`.trim()
    const embeddingResponse = await fetch('/api/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textForEmbedding })
    });

    if (!embeddingResponse.ok) {
      throw new Error('Failed to generate embedding');
    }

    const { embedding } = await embeddingResponse.json();

    // Create database entry
    const { error: dbError, data } = await supabase
      .from('meme_templates')
      .insert({
        name: templateName,
        instructions: templateExplanation,
        video_url: publicUrl,
        embedding,
        is_greenscreen: isGreenscreen
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    // Reset form
    setFile(null)
    setPreview('')
    setTemplateName('')
    setTemplateExplanation('')
    setPastedImages([])
    toast.success('Template uploaded successfully!')

  } catch (err) {
    console.error('Error details:', err)
    setError(err instanceof Error ? err.message : 'An error occurred while uploading')
    toast.error('Upload failed')
  } finally {
    setLoading(false)
  }
}
```

#### 2. Image Pasting

The `handlePaste` function enables pasting images directly from the clipboard:
- Captures clipboard data
- Filters for image items
- Converts images to base64 format
- Stores them in state for AI enhancement
- Multiple images can be pasted sequentially

```typescript
const handlePaste = async (e: React.ClipboardEvent) => {
  const items = e.clipboardData?.items
  if (!items) return

  const imageItems = Array.from(items).filter(item => item.type.startsWith('image'))
  
  for (const item of imageItems) {
    const blob = item.getAsFile()
    if (!blob) continue

    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target?.result as string
      setPastedImages(prev => [...prev, base64])
    }
    reader.readAsDataURL(blob)
  }
}
```

#### 3. AI Enhancement

The `handleEnhanceDescription` function is the core of the AI enhancement feature:
- Validates the current description
- Prepares the API payload with description and images
- Handles both streaming and non-streaming responses
- Provides proper error handling and fallbacks
- Updates the textarea with enhanced content

```typescript
const handleEnhanceDescription = async () => {
  if (!templateExplanation.trim()) {
    toast.error('Please provide an initial description')
    return
  }

  // Store original description for fallback
  const originalDescription = templateExplanation
  
  setIsEnhancing(true)
  
  try {
    // Format the API request
    const apiPayload = {
      description: originalDescription,
      images: pastedImages
    }
    
    console.log('Sending request to enhance template with:', 
      `Description: ${originalDescription.substring(0, 50)}...`,
      `${pastedImages.length} images`
    )
    
    const response = await fetch('/api/enhance-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiPayload)
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Error response:', error)
      throw new Error(error || 'Enhancement failed')
    }

    // Check response type (streaming vs non-streaming)
    const contentType = response.headers.get('content-type')
    const isStream = contentType && contentType.includes('text/event-stream')
    
    console.log('Response type:', contentType, isStream ? 'Streaming' : 'Non-streaming')
    
    if (isStream && response.body) {
      // Handle streaming response
      console.log('Processing streaming response')
      
      // Create decoder for the stream
      const decoder = new TextDecoder()
      const reader = response.body.getReader()
      
      // Start with empty enhanced description
      let enhancedDescription = ''
      let isFirstChunk = true
      
      // Read the stream
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        // Decode the chunk and add to our accumulated text
        const chunk = decoder.decode(value, { stream: true })
        enhancedDescription += chunk
        
        // Only clear the original text once we start receiving the enhanced version
        if (isFirstChunk && chunk.trim().length > 0) {
          setTemplateExplanation('')  // Clear now that we have content coming in
          isFirstChunk = false
          console.log('First chunk received, cleared original text')
        }
        
        // Update the textarea with the text we have so far
        if (!isFirstChunk) {
          setTemplateExplanation(enhancedDescription)
        }
      }
      
      // Final processing after stream completes
      if (enhancedDescription.trim().length > 0) {
        setTemplateExplanation(enhancedDescription)
        toast.success('Description enhanced!')
      } else {
        console.error('Received empty enhanced description')
        setTemplateExplanation(originalDescription)
        toast.error('Received empty response, keeping original description')
      }
    } else {
      // Handle direct text response
      console.log('Processing non-streaming response')
      
      const enhancedText = await response.text()
      
      if (enhancedText && enhancedText.trim().length > 0) {
        setTemplateExplanation(enhancedText)
        toast.success('Description enhanced!')
      } else {
        console.error('Received empty response text')
        setTemplateExplanation(originalDescription)
        toast.error('Received empty response, keeping original description')
      }
    }
  } catch (err) {
    console.error('Enhancement error:', err)
    toast.error(err instanceof Error ? err.message : 'Failed to enhance description')
    // Restore original description on error
    setTemplateExplanation(originalDescription)
  } finally {
    setIsEnhancing(false)
  }
}
```

#### 4. Auto-Expanding Textarea

The component includes an auto-expanding textarea that grows to fit its content:

```typescript
// Auto-resize textarea when content changes
useEffect(() => {
  const textarea = textareaRef.current;
  if (textarea) {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set the height to match the content (plus a small buffer)
    textarea.style.height = `${textarea.scrollHeight + 2}px`;
  }
}, [templateExplanation]);
```

#### 5. Drag and Drop Implementation

A set of handlers manage the drag and drop functionality:

```typescript
const handleDrag = useCallback((e: React.DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
}, [])

const handleDragIn = useCallback((e: React.DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  setIsDragging(true)
}, [])

const handleDragOut = useCallback((e: React.DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  setIsDragging(false)
}, [])

const handleDrop = useCallback((e: React.DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  setIsDragging(false)

  const droppedFile = e.dataTransfer.files?.[0]
  if (droppedFile && droppedFile.type.startsWith('video/')) {
    setFile(droppedFile)
    setPreview(URL.createObjectURL(droppedFile))
  }
}, [])
```

## API Integration

### AI Enhancement Endpoint

The Template Uploader communicates with a specialized API endpoint at `/api/enhance-template` that processes template descriptions using Claude 3.7 Sonnet:

```typescript
// API request structure
interface RequestBody {
  description: string;
  images: string[]; // Base64 encoded images
}

// Making the API call
const response = await fetch('/api/enhance-template', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    description: originalDescription,
    images: pastedImages
  })
})
```

### Embedding Generation

For vector similarity search, the component generates embeddings for the template text:

```typescript
const embeddingResponse = await fetch('/api/embeddings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: textForEmbedding })
});
```

## Technical Implementation Details

### AI Enhancement

The AI enhancement feature uses Claude 3.7 Sonnet to generate detailed template descriptions:

1. **Prompt Structure**: Uses a specialized prompt that guides Claude to analyze the template in a structured format:
   - Visual description
   - Emotional context
   - Usage patterns
   - Example captions
   - Instructions for use

2. **Image Processing**: Sends images to Claude as base64-encoded data to provide visual context for better analysis.

3. **Response Handling**: Implements dual handling for both streaming and non-streaming responses:
   - Streaming: Real-time updates of the description as chunks arrive
   - Non-streaming: Batch processing of the complete response

4. **Response Format**: Returns structured markdown content with sections for different aspects of the template.

### Implementation Challenges

#### 1. Streaming Response Handling

The initial implementation used streaming responses for real-time updates, but encountered several challenges:

- **Edge Runtime Limitations**: Next.js Edge Runtime has specific constraints on response handling
- **Stream Parsing Complexity**: Parsing the streaming response required careful buffer management
- **UI Update Frequency**: Balancing between too many updates and a responsive UI was challenging

Resolution: We implemented a dual-path solution:
- Maintained streaming response handling for real-time feedback
- Added non-streaming fallback for more reliable operation
- Added comprehensive error logging and fallback mechanisms
- Currently using the non-streaming approach as the primary method

#### 2. Claude API Model Versions

There was a critical issue with the Claude model ID:
- Initial implementation used `claude-3-7-sonnet-20240307`
- Correct version is `claude-3-7-sonnet-20250219`
- The incorrect model ID resulted in fallback responses instead of AI-enhanced content

Resolution:
- Updated the model ID to match what's used elsewhere in the application
- Added enhanced error logging to quickly identify similar issues in the future
- Added clear labeling of fallback responses to distinguish them from real AI responses

#### 3. Response Format Inconsistencies

Initial testing revealed inconsistencies in how the API responses were processed:
- Some were processed as streaming even though they weren't
- Empty responses were not always properly handled
- Error responses sometimes contained useful information that wasn't displayed

Resolution:
- Added content-type checking to properly identify response types
- Added comprehensive error logging for API responses
- Implemented better fallback mechanisms
- Added more informative error messages

#### 4. Textarea Size Management

The initial implementation had a fixed-height textarea that made it difficult to view long AI-generated descriptions. 

Resolution:
- Implemented an auto-expanding textarea that grows with content
- Used a useEffect hook to dynamically update the textarea height
- Set a minimum height to maintain usability with short content
- Preserved scrollability for extremely long content

## UI Components

The Template Uploader UI consists of several key components:

1. **Form Fields**:
   - Template name input
   - Template explanation textarea (auto-expanding)
   - Greenscreen toggle checkbox

2. **Video Upload Area**:
   - Drag and drop zone
   - File input button
   - Video preview with controls
   - Change video button

3. **AI Enhancement**:
   - "Enhance with AI" button
   - Loading state feedback
   - Error notifications

4. **Pasted Images Display**:
   - Grid layout for multiple images
   - Delete buttons for individual images
   - Visual feedback for pasted images

5. **Form Submission**:
   - Submit button with loading state
   - Success/error notifications
   - Form validation

## Error Handling

The Template Uploader implements comprehensive error handling:

1. **Form Validation Errors**:
   - Required field validation
   - File type validation
   - Error messages for validation failures

2. **API Request Errors**:
   - Network error handling
   - API error response parsing
   - User-friendly error messages

3. **File Processing Errors**:
   - File read errors
   - File type compatibility errors
   - File size limit errors

4. **AI Enhancement Errors**:
   - API connectivity errors
   - Empty response handling
   - Timeout handling
   - Fallback to original description on error

5. **Database Operation Errors**:
   - Storage upload errors
   - Database insertion errors
   - Embedding generation errors

## Database Schema

Templates are stored in Supabase with the following schema:

```typescript
interface MemeTemplate {
  id: string;
  name: string;
  instructions: string;
  video_url: string;
  embedding: number[];
  is_greenscreen: boolean;
  created_at: string;
}
```

## Future Improvements

1. **Template Categorization**:
   - Add category tagging
   - Implement tag-based filtering

2. **AI Enhancement Options**:
   - Allow users to select enhancement focus (visual, usage, examples)
   - Provide template-specific enhancement options

3. **Batch Upload**:
   - Enable uploading multiple templates at once
   - Batch processing of enhancements

4. **Preview Enhancement**:
   - Real-time preview of enhanced descriptions
   - Side-by-side comparison with original

5. **Enhanced Error Recovery**:
   - Partial submission recovery
   - Draft saving functionality

6. **Performance Optimizations**:
   - Image compression before upload
   - Optimized streaming response handling

7. **Accessibility Improvements**:
   - Enhanced keyboard navigation
   - Screen reader optimizations
   - High contrast mode support

## Troubleshooting Guide

### Common Issues

1. **AI Enhancement Not Working**:
   - Check API key validity
   - Verify correct model ID (`claude-3-7-sonnet-20250219`)
   - Ensure description has sufficient initial content
   - Check image format compatibility
   - Review console logs for detailed error information

2. **Image Paste Not Working**:
   - Verify browser clipboard permissions
   - Check image format compatibility
   - Try using different image sources
   - Clear browser cache and try again

3. **Video Upload Failing**:
   - Check file size limitations
   - Verify file format compatibility
   - Check network connectivity
   - Verify Supabase configuration

4. **Database Insertion Errors**:
   - Check Supabase connectivity
   - Verify embedding format
   - Check for duplicate entries
   - Verify field validation requirements

### Error Codes and Meanings

| Error Code | Meaning                       | Resolution                                         |
|------------|-------------------------------|---------------------------------------------------|
| 400        | Bad request format            | Check request body structure                       |
| 401        | Authentication failure        | Verify API keys                                    |
| 403        | Permission denied             | Check access permissions                           |
| 404        | Endpoint not found            | Verify API route path                              |
| 413        | Payload too large             | Reduce image/file size                             |
| 429        | Rate limit exceeded           | Implement request throttling                       |
| 500        | Server error                  | Check server logs, try again later                 |
| 503        | Service unavailable           | AI service may be down, try again later            |

## Testing Procedure

1. **Basic Functionality**:
   - Create template with name and description
   - Upload video file
   - Toggle greenscreen option
   - Submit form
   - Verify database entry

2. **AI Enhancement**:
   - Enter basic description
   - Paste sample images
   - Click "Enhance with AI"
   - Verify enhanced content is received
   - Verify textarea expands properly

3. **Error Handling**:
   - Submit without required fields
   - Submit with invalid file format
   - Test network disconnection
   - Test AI service unavailability

4. **Edge Cases**:
   - Very long descriptions
   - Multiple pasted images
   - Special characters in template name
   - Very large video files

## Conclusion

The Template Uploader is a sophisticated component that combines file handling, form management, AI integration, and database operations. Its AI enhancement feature dramatically improves the quality and consistency of template descriptions, which in turn improves template searchability and usability throughout the application.

The component demonstrates effective handling of complex asynchronous operations, sophisticated error management, and elegant UI feedback mechanisms, making it a comprehensive example of modern React component architecture. 