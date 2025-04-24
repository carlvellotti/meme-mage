'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import { MemeTemplate } from '@/lib/supabase/types'
import { v4 as uuidv4 } from 'uuid'

// Define the UnprocessedTemplate type (or import if defined elsewhere)
interface UnprocessedTemplate {
  id: string;
  cropped_video_url?: string | null;
  caption_text?: string | null;
  // ... other fields if needed
}

interface TemplateUploaderProps {
  initialVideoUrl?: string;        // Added
  initialExplanation?: string;     // Added
  unprocessedTemplateId?: string;  // Added
  initialSourceUrl?: string;       // Added
  onTemplateUploaded?: () => void; // Added
}

export function TemplateUploader({ 
  initialVideoUrl,
  initialExplanation,
  unprocessedTemplateId,
  initialSourceUrl,
  onTemplateUploaded
}: TemplateUploaderProps) {
  const supabase = createClient()
  const [templateName, setTemplateName] = useState('')
  const [templateExplanation, setTemplateExplanation] = useState('')
  const [uploaderName, setUploaderName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isGreenscreen, setIsGreenscreen] = useState(false)
  const [pastedImages, setPastedImages] = useState<string[]>([])
  const [isEnhancing, setIsEnhancing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Effect to handle initial values from props
  useEffect(() => {
    if (initialExplanation) {
      setTemplateExplanation(initialExplanation)
    }
  }, [initialExplanation])

  useEffect(() => {
    if (initialVideoUrl) {
      setPreview(initialVideoUrl) // Set preview directly from URL
      setFile(null) // Clear any selected file if initial URL is provided
    }
  }, [initialVideoUrl])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    let storageUrl = '';

    try {
      // 1. Handle file upload OR use initialVideoUrl
      if (file) {
        console.log('Uploading new file...');
        const filename = `${Date.now()}-${file.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('meme-templates')
          .upload(filename, file)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('meme-templates')
          .getPublicUrl(uploadData.path)
        storageUrl = publicUrl;
        console.log('File uploaded, URL:', storageUrl);
      } else if (initialVideoUrl) {
        console.log('Using initial video URL:', initialVideoUrl);
        storageUrl = initialVideoUrl; // Use the provided URL directly
      } else {
        throw new Error('No video file selected or provided')
      }

      if (!storageUrl) {
        throw new Error('Could not determine video URL');
      }

      // --- BEGIN THUMBNAIL GENERATION ---
      let thumbnailUrl: string | null = null;
      try {
        console.log(`Requesting thumbnail generation for ${storageUrl}...`);
        const thumbnailResponse = await fetch('/api/generate-thumbnail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrl: storageUrl }),
        });

        if (thumbnailResponse.ok) {
          const { thumbnailUrl: receivedUrl } = await thumbnailResponse.json();
          thumbnailUrl = receivedUrl;
          console.log(`Thumbnail generated successfully: ${thumbnailUrl}`);
        } else {
          const errorText = await thumbnailResponse.text();
          console.error(`Thumbnail generation failed: ${thumbnailResponse.status} - ${errorText}`);
          toast.error('Video uploaded, but thumbnail generation failed.'); // Inform user, but don't block
        }
      } catch (thumbError) {
        console.error('Error calling thumbnail generation API:', thumbError);
        toast.error('Video uploaded, but thumbnail generation encountered an error.'); // Inform user
      }
      // --- END THUMBNAIL GENERATION ---

      // 2. Generate embedding (existing logic)
      const textForEmbedding = `${templateName}. ${templateExplanation}`.trim()
      if (!textForEmbedding) {
        throw new Error('Template name and explanation cannot be empty for embedding generation.');
      }
      console.log('Generating embedding for:', textForEmbedding.substring(0, 100) + '...');
      const embeddingResponse = await fetch('/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textForEmbedding })
      });

      if (!embeddingResponse.ok) {
        const errorText = await embeddingResponse.text();
        console.error('Embedding API Error:', errorText);
        throw new Error(`Failed to generate embedding: ${errorText}` || 'Failed to generate embedding');
      }

      const { embedding } = await embeddingResponse.json();
      console.log('Embedding received, length:', embedding?.length);
      if (!embedding || embedding.length === 0) {
        throw new Error('Received invalid embedding from API');
      }

      // 3. Create database entry (add original_source_url and poster_url)
      console.log('Saving template to database...');
      const { error: dbError, data: dbData } = await supabase
        .from('meme_templates')
        .insert({
          name: templateName,
          instructions: templateExplanation,
          video_url: storageUrl,
          embedding,
          is_greenscreen: isGreenscreen,
          uploader_name: uploaderName,
          original_source_url: initialSourceUrl,
          poster_url: thumbnailUrl
        })
        .select()
        .single();

      if (dbError) {
        console.error('DB Insert Error:', dbError);
        throw dbError;
      }

      console.log('Template saved successfully:', dbData);

      // 4. Delete from unprocessed_templates if applicable (NEW LOGIC)
      if (unprocessedTemplateId) {
        console.log(`Attempting to delete unprocessed template ID: ${unprocessedTemplateId}`);
        try {
          const deleteResponse = await fetch(`/api/unprocessed-templates/${unprocessedTemplateId}`, {
            method: 'DELETE',
          });

          if (!deleteResponse.ok) {
            // Log error but don't block success toast if main upload worked
            const deleteErrorText = await deleteResponse.text();
            console.error(`Failed to delete unprocessed template ${unprocessedTemplateId}. Status: ${deleteResponse.status}. Error: ${deleteErrorText}`);
            toast.error(`Template saved, but failed to remove from unprocessed list (ID: ${unprocessedTemplateId}).`);
          } else {
            console.log(`Successfully deleted unprocessed template ID: ${unprocessedTemplateId}`);
          }
        } catch (deleteFetchError) {
          console.error(`Error making DELETE request for unprocessed template ${unprocessedTemplateId}:`, deleteFetchError);
          toast.error(`Template saved, but encountered an error removing from unprocessed list (ID: ${unprocessedTemplateId}).`);
        }
      }

      // 5. Reset form and notify parent
      setFile(null)
      setPreview('')
      setTemplateName('')
      setTemplateExplanation('')
      setPastedImages([])
      setIsGreenscreen(false) // Reset greenscreen toggle
      // Clear internal state related to initial props if needed, although they should be overwritten on next selection

      toast.success('Template uploaded successfully!')
      
      // Call the callback if provided
      if (onTemplateUploaded) {
        onTemplateUploaded()
      }

    } catch (err) {
      console.error('Error details:', err)
      setError(err instanceof Error ? err.message : 'An error occurred while uploading')
      toast.error('Upload failed')
    } finally {
      setLoading(false)
    }
  }

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

  const enhanceDescription = async () => {
    if (!templateExplanation.trim()) {
      toast.error('Please provide an initial description')
      return
    }

    // Store original description in case we need to restore it on error
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

      // Check if the response is a streaming response or regular text
      const contentType = response.headers.get('content-type')
      const isStream = contentType && contentType.includes('text/event-stream')
      
      console.log('Response type:', contentType, isStream ? 'Streaming' : 'Non-streaming')
      
      if (isStream && response.body) {
        // Handle streaming response
        console.log('Processing streaming response')
        
        // Create a decoder for the stream
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
          
          // Log chunks as they come in (limited logging to prevent console spam)
          if (enhancedDescription.length < 200) {
            console.log('Stream chunk received:', chunk.substring(0, 50))
          }
        }
        
        // Final processing after stream completes
        console.log('Enhancement complete. Final length:', enhancedDescription.length)
        console.log('Enhanced description preview:', enhancedDescription.substring(0, 100) + '...')
        
        // Make sure the final enhanced text is in the textarea
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
        console.log('Received enhanced text, length:', enhancedText.length)
        
        if (enhancedText && enhancedText.trim().length > 0) {
          console.log('Enhanced text preview:', enhancedText.substring(0, 100) + '...')
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-gray-800 p-6 rounded-lg border border-gray-700">
      <div>
        <label htmlFor="template-name" className="block text-sm font-medium text-gray-300 mb-2">
          Template Name
        </label>
        <input
          type="text"
          id="template-name"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          className="w-full p-3 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="Enter a descriptive name for the template"
          required
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label htmlFor="template-explanation" className="block text-sm font-medium text-gray-300">
            Template Explanation
          </label>
          <button
            type="button"
            onClick={enhanceDescription}
            disabled={isEnhancing || !templateExplanation.trim()}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            {isEnhancing ? (
              <>
                <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Enhancing...</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Enhance with AI</span>
              </>
            )}
          </button>
        </div>
        <textarea
          ref={textareaRef}
          id="template-explanation"
          value={templateExplanation}
          onChange={(e) => setTemplateExplanation(e.target.value)}
          onPaste={handlePaste}
          className="w-full p-3 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 min-h-[120px]"
          placeholder="Explain how this template should be used, what captions work well, etc."
          required
        />
      </div>

      {pastedImages.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mt-4">
          {pastedImages.map((image, index) => (
            <div key={index} className="relative group">
              <img 
                src={image} 
                alt={`Example ${index + 1}`} 
                className="w-full h-40 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => setPastedImages(prev => prev.filter((_, i) => i !== index))}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <label htmlFor="uploader-name" className="block text-sm font-medium text-gray-300 mb-2">
          Your Name
        </label>
        <input
          type="text"
          id="uploader-name"
          value={uploaderName}
          onChange={(e) => setUploaderName(e.target.value)}
          className="w-full p-3 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="Enter your name"
          required
        />
      </div>

      <div>
        <div className="flex items-center mb-2">
          <label className="flex items-center text-sm font-medium text-gray-300">
            <input
              type="checkbox"
              checked={isGreenscreen}
              onChange={(e) => setIsGreenscreen(e.target.checked)}
              className="mr-2 h-4 w-4"
            />
            This is a greenscreen template
          </label>
        </div>
      </div>

      {isGreenscreen && (
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-green-700">
            ℹ️ Greenscreen templates should have a solid green background for best results. 
            The green background will be replaced with user-selected backgrounds when creating memes.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Template Video
        </label>
        
        {preview ? (
          <div className="space-y-4">
            <div className="relative aspect-video rounded-lg overflow-hidden border border-gray-700 bg-gray-900">
              <video
                src={preview}
                className="w-full h-full object-contain"
                controls
              />
              <button
                type="button"
                onClick={() => {
                  setFile(null)
                  setPreview('')
                }}
                className="absolute top-2 right-2 bg-gray-800 bg-opacity-70 rounded-full p-1 text-white hover:bg-opacity-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center ${
              isDragging ? 'border-blue-500 bg-blue-50 bg-opacity-10' : 'border-gray-700'
            }`}
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="video/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setFile(file)
                  setPreview(URL.createObjectURL(file))
                }
              }}
              className="hidden"
              id="video-upload"
            />
            <label
              htmlFor="video-upload"
              className="cursor-pointer"
            >
              <div className="space-y-2">
                <div className="flex justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="text-gray-300">
                  <p className="font-medium">Drag and drop your video here, or click to select</p>
                  <p className="text-sm">MP4, WebM, or other video formats</p>
                </div>
              </div>
            </label>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || (!file && !preview) || !templateName.trim() || !templateExplanation.trim()}
        className="w-full py-3 px-4 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Uploading...' : 'Upload Template'}
      </button>
    </form>
  )
} 