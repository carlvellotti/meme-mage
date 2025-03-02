# Template-Specific Meme Creation Flow

## Overview

The template-specific meme creation flow allows users to select a specific template from the template library and generate AI-powered captions tailored to that template. This document provides a comprehensive technical overview of the implementation, data flow, component interactions, and API integrations.

## Architecture

The template-specific flow consists of three main components:

1. **TemplateBrowser**: Entry point that displays available templates and handles initial template selection
2. **TemplateSpecificGenerator**: Handles caption generation for a specific template
3. **MemeGenerator**: Final stage for customizing and creating the meme

These components work together in a sequential flow, passing template and caption data between them.

## Component Breakdown

### 1. TemplateBrowser Component

**Purpose**: Display available templates and provide entry points to the template-specific flow.

**Key Features**:
- Fetches templates from `/api/templates` endpoint with cache-busting timestamp
- Displays templates in a grid layout with preview videos
- Provides a "Refresh" button to manually fetch the latest templates
- Implements infinite scrolling for template browsing
- Provides two interaction modes:
  - Direct selection (passes template to parent)
  - "Create" button (initiates template-specific flow)

**State Management**:
- `templates`: Array of MemeTemplate objects
- `visibleTemplates`: Subset of templates displayed for infinite scrolling
- `page`: Current page number for pagination
- `selectedTemplate`: Currently selected template for the specific flow
- `isLoading`: Loading state for template fetching
- `isRefreshing`: Loading state for manual refresh
- `error`: Error state for template fetching
- `hoveredTemplate`: ID of the currently hovered template

**Key Methods**:
- `fetchTemplates()`: Fetches templates from API with cache-busting
- `refreshTemplates()`: Manually triggers a template refresh
- `handleCardClick()`: Navigates to template detail page
- `handleCreateClick()`: Initiates template-specific flow
- `handleBack()`: Returns to template browser from specific generator

**Data Flow**:
- On mount: Fetches templates from API
- On refresh: Re-fetches templates with a new timestamp parameter
- On template selection: Passes template to parent via `onSelectTemplate`
- On "Create" button: Sets `selectedTemplate` and renders TemplateSpecificGenerator

**Code Path**: `src/app/components/TemplateBrowser.tsx`

### 2. TemplateSpecificGenerator Component

**Purpose**: Generate AI-powered captions for a specific template.

**Key Features**:
- Template preview with video
- Template instructions editor
- AI-powered caption generation
- Caption selection interface

**Props**:
- `template`: The selected MemeTemplate object
- `onBack`: Function to return to template browser
- `onSelectTemplate`: Function to pass selected template and caption to parent
- `isGreenscreenMode`: Boolean indicating if greenscreen mode is active

**State Management**:
- `prompt`: User input for caption generation
- `audience`: Target audience for captions
- `selectedModel`: AI model selection ('openai', 'anthropic', 'anthropic-3-5')
- `generatedCaptions`: Array of generated captions
- `instructions`: Template usage instructions
- `isEditingInstructions`: Boolean for instructions edit mode
- `isSavingInstructions`: Boolean for instructions save state

**Key Methods**:
- `handleSubmit()`: Processes form submission and generates captions
- `handleCaptionSelect()`: Handles caption selection and passes data to parent
- `saveInstructions()`: Updates template instructions in the database

**API Interactions**:
1. **Caption Generation**:
   - Primary: `/api/anthropic/tool-selection` (Claude with tools)
   - Fallback: `/api/anthropic/chat` or `/api/openai/chat`
   - Payload structure:
     ```typescript
     {
       messages: [{
         role: 'user',
         content: `I want to create a meme with this idea: "${prompt}"\n\nAvailable templates:\n${templateText}`,
         audience: audience || 'general audience'
       }],
       model: selectedModel === 'anthropic-3-5' ? 'claude-3-5-sonnet-20241022' : 'claude-3-7-sonnet-20250219'
     }
     ```

2. **Template Instructions Update**:
   - Endpoint: `/api/templates/${template.id}/update-instructions`
   - Method: PUT
   - Payload: `{ instructions }`

**Error Handling**:
- Graceful fallback from tool-based to regular endpoint
- Detailed error logging and user feedback via toast notifications
- Proper loading states during API calls

**Code Path**: `src/app/components/TemplateSpecificGenerator.tsx`

### 3. MemeGenerator Component

**Purpose**: Final stage for customizing and creating the meme with the selected template and caption.

**Key Features**:
- Video preview with caption
- Text customization options
- Background selection (in greenscreen mode)
- Label addition and positioning
- Meme download functionality

**Props**:
- `isGreenscreenMode`: Boolean for greenscreen mode
- `onToggleMode`: Function to toggle greenscreen mode
- `initialTemplate`: Pre-selected template (from template-specific flow)
- `initialCaption`: Pre-selected caption (from template-specific flow)
- `initialOptions`: Complete options object with templates and captions
- `onBack`: Function to return to caption selection

**State Management**:
- `selectedTemplate`: Current template
- `caption`: Current caption text
- `textSettings`: Caption styling and positioning
- `labels`: Additional text labels
- `labelSettings`: Styling for labels
- `selectedBackground`: Background image (for greenscreen)
- `previewCanvas`: Canvas element for preview

**Initialization Logic**:
- When receiving `initialTemplate` and `initialCaption`:
  1. Sets `selectedTemplate` to `initialTemplate`
  2. Sets `caption` to `initialCaption`
  3. Calls `updatePreview()` to generate initial preview

**Key Methods**:
- `updatePreview()`: Generates preview using canvas
- `handleDownloadMeme()`: Creates and downloads final meme
- `handleBack()`: Returns to caption selection
- `updateTextSetting()`: Updates caption styling
- `addLabel()`, `updateLabel()`, `deleteLabel()`: Label management

**Video Processing**:
- Uses `createMemePreview()` from `src/lib/utils/previewGenerator.ts`
- Uses `createMemeVideo()` from `src/lib/utils/videoProcessor.ts` for final output

**Code Path**: `src/app/components/MemeGenerator.tsx`

## Data Flow

### Complete User Journey

1. **Template Selection**:
   - User browses templates in TemplateBrowser
   - User clicks "Create" on a specific template
   - TemplateBrowser sets selectedTemplate and renders TemplateSpecificGenerator

2. **Caption Generation**:
   - User enters prompt and audience in TemplateSpecificGenerator
   - Component calls AI API to generate captions
   - User selects a caption
   - Component creates a structured data object:
     ```typescript
     {
       templates: [{
         template: template,
         captions: generatedCaptions
       }],
       selectedTemplate: template,
       selectedCaption: caption
     }
     ```
   - Data is passed to parent (MemeDatabase) via onSelectTemplate

3. **Meme Creation**:
   - MemeDatabase renders MemeGenerator with initialTemplate, initialCaption, and initialOptions
   - MemeGenerator initializes with provided data
   - User customizes text settings, adds labels, selects background (if in greenscreen mode)
   - User downloads final meme

### Data Structure

The core data structure passed between components is:

```typescript
interface SelectedMeme {
  templates: {
    template: MemeTemplate;
    captions: string[];
  }[];
  selectedTemplate?: MemeTemplate;
  selectedCaption?: string;
}
```

Where `MemeTemplate` is defined as:

```typescript
interface MemeTemplate {
  id: string;
  name: string;
  video_url: string;
  instructions?: string;
  is_greenscreen: boolean;
  created_at?: string;
  updated_at?: string;
  embedding?: string;
  description?: string;
}
```

## API Routes

### 1. Template Listing
- **Endpoint**: `/api/templates`
- **Method**: GET
- **Query Parameters**:
  - `t`: Timestamp for cache-busting (optional)
- **Response Headers**:
  - `Cache-Control: no-store, max-age=0`
  - `Pragma: no-cache`
  - `Expires: 0`
- **Response**: Array of MemeTemplate objects ordered by creation date (newest first)
- **Implementation**: `src/app/api/templates/route.ts`

### 2. Template Instructions Update
- **Endpoint**: `/api/templates/[id]/update-instructions`
- **Method**: PUT
- **Payload**: `{ instructions: string }`
- **Response**: `{ success: boolean, data: MemeTemplate }`
- **Implementation**: `src/app/api/templates/[id]/update-instructions/route.ts`

### 3. AI Caption Generation
- **Tool-based Endpoint**: `/api/anthropic/tool-selection`
- **Regular Endpoints**: 
  - `/api/anthropic/chat`
  - `/api/openai/chat`
- **Method**: POST
- **Payload**: Messages array with prompt and audience
- **Response**: Generated captions structured as:
  ```typescript
  {
    templates: [
      {
        template: number,
        captions: string[]
      }
    ]
  }
  ```

## Error Handling

The template-specific flow implements robust error handling:

1. **API Failures**:
   - Detailed error logging in browser console
   - User-friendly toast notifications
   - Graceful fallbacks between endpoints

2. **Template Instructions Update**:
   - Validation before saving
   - Detailed error reporting
   - Optimistic UI updates with rollback on failure

3. **Caption Generation**:
   - Multi-tiered fallback system:
     1. Try tool-based endpoint first
     2. Fall back to regular endpoint if tool-based fails
     3. Show error if both fail
   - Loading states during API calls

4. **Template Fetching**:
   - Error reporting with fallback UI
   - Manual refresh capability to recover from failed fetches
   - Cache-busting mechanisms to ensure fresh data

## Implementation Notes

### Tool-based vs Regular Endpoints

The template-specific generator attempts to use the tool-based endpoint first, which is designed to work with multiple templates. When used with a single template, this endpoint may return a 500 error because it expects to format responses for two templates.

This is expected behavior, and the code gracefully falls back to the regular endpoint, which works correctly with a single template. This fallback mechanism ensures a smooth user experience even when the primary endpoint fails.

### Template Instructions Editor

The template instructions editor allows authorized users to update the usage instructions for a template. These instructions are used to guide the AI in generating appropriate captions.

The update process:
1. User edits instructions in textarea
2. On save, sends PUT request to `/api/templates/[id]/update-instructions`
3. Updates local state on success
4. Shows success/error toast notification

### Cache Prevention for Templates

To ensure users always see the latest templates:

1. The TemplateBrowser component:
   - Adds a timestamp parameter to API requests to bypass browser caching
   - Provides a manual refresh button to force a fresh data fetch
   - Implements loading states during template fetching and refreshing

2. The templates API endpoint:
   - Orders templates by creation date (newest first) to highlight new additions
   - Sets multiple cache control headers to prevent browser and CDN caching
   - Logs timestamp-based requests for debugging purposes

### Next.js API Routing

The API routes use Next.js App Router API conventions:
- Route handlers in `route.ts` files
- Dynamic parameters with `[param]` folder naming
- Response using NextResponse.json()

A critical configuration in `next.config.mjs` ensures that only OpenAI-specific API calls are rewritten to the OpenAI API:

```javascript
async rewrites() {
  return [
    {
      source: "/api/openai/:path*",
      destination: "https://api.openai.com/:path*",
    },
  ];
}
```

## Performance Considerations

1. **Preview Generation**:
   - Canvas-based preview generation is computationally intensive
   - The system seeks to a specific timestamp (0.1s) for stable frame capture
   - Preview updates are triggered only when necessary

2. **API Calls**:
   - AI endpoints can have high latency
   - Loading states are shown during API calls
   - Cache control headers prevent unwanted caching for data that needs to be fresh

3. **Video Processing**:
   - Final video generation happens client-side
   - Uses efficient canvas operations
   - Properly cleans up resources after processing

4. **Template Loading**:
   - Infinite scrolling to avoid loading all templates at once
   - Pagination implemented through the `visibleTemplates` state
   - Intersection Observer API for efficient scroll detection

## Future Improvements

1. **Template Management**:
   - Add template categories and tags
   - Implement template search and filtering
   - Add template usage analytics

2. **Caption Generation**:
   - Fine-tune prompts for better caption quality
   - Add caption history and favorites
   - Implement user feedback loop for caption quality

3. **UI Enhancements**:
   - Add keyboard shortcuts
   - Implement drag-and-drop for labels
   - Add template preview animations

4. **Performance**:
   - Optimize canvas operations
   - Implement server-side rendering where appropriate
   - Add more sophisticated caching with proper invalidation strategies

## Troubleshooting

### Common Issues

1. **API 404 Errors**:
   - Check Next.js rewrites configuration
   - Verify API route file structure
   - Check for typos in API endpoint URLs

2. **Template Instructions Not Saving**:
   - Check browser console for detailed errors
   - Verify Supabase connection and permissions
   - Check for API route implementation issues

3. **Caption Generation Failures**:
   - Verify AI API keys and quotas
   - Check network tab for detailed error responses
   - Verify prompt formatting

4. **Templates Not Displaying or Updating**:
   - Click the Refresh button to force a new fetch
   - Check the Network tab for API responses
   - Verify database connection and permissions
   - Clear browser cache if necessary

### Debugging Tools

1. **Console Logging**:
   - Extensive logging is implemented throughout the flow
   - Key events and data structures are logged
   - API responses and errors are detailed
   - Template fetch requests include timestamps in logs

2. **Network Monitoring**:
   - All API calls can be monitored in browser dev tools
   - Response structures are logged for debugging
   - Cache-related headers can be inspected

3. **Test Endpoint**:
   - A simple test endpoint at `/api/test` returns a success message
   - Use to verify API routing is working correctly

## Conclusion

The template-specific meme creation flow provides a streamlined, user-friendly experience for creating memes from specific templates. By combining AI-powered caption generation with a focused template selection, users can quickly create high-quality, contextually appropriate memes.

The implementation balances flexibility, performance, and error resilience, with graceful fallbacks and detailed error handling throughout the flow. The modular component architecture allows for future enhancements and extensions while maintaining a clean separation of concerns.

The recent addition of refresh functionality and cache prevention mechanisms ensures users always have access to the latest templates, improving the overall user experience and preventing confusion when new templates aren't immediately visible. 