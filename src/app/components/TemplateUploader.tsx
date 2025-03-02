'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'

export function TemplateUploader() {
  const [templateName, setTemplateName] = useState('')
  const [templateExplanation, setTemplateExplanation] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isGreenscreen, setIsGreenscreen] = useState(false)
  const [pastedImages, setPastedImages] = useState<string[]>([])
  const [isEnhancing, setIsEnhancing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

    try {
      if (!file) {
        throw new Error('Please select a video file')
      }

      // Handle file upload
      const filename = `${Date.now()}-${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('meme-templates')
        .upload(filename, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('meme-templates')
        .getPublicUrl(uploadData.path)

      // Generate embedding from name and instructions
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
      console.log('Embedding to store:', embedding.length); // Should be 1536

      // Create database entry with isGreenscreen flag
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
        console.error('DB Error:', dbError);
        throw dbError;
      }

      console.log('Stored template with embedding:', data);

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

  const handleEnhanceDescription = async () => {
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="templateName" className="block text-sm font-medium text-gray-700 mb-2">
          Template Name
        </label>
        <input
          id="templateName"
          type="text"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="Enter template name"
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isGreenscreen"
          checked={isGreenscreen}
          onChange={(e) => setIsGreenscreen(e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded"
        />
        <label htmlFor="isGreenscreen" className="text-sm font-medium text-gray-700">
          This is a greenscreen template
        </label>
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
        <label htmlFor="templateExplanation" className="block text-sm font-medium text-gray-700 mb-2">
          How to Use This Template
        </label>
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            id="templateExplanation"
            value={templateExplanation}
            onChange={(e) => setTemplateExplanation(e.target.value)}
            onPaste={handlePaste}
            className="w-full px-4 py-2 border rounded-md min-h-[8rem] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Explain how this meme template works and how to use it effectively... (Paste images here for better AI analysis)"
            required
          />
          <button
            type="button"
            onClick={handleEnhanceDescription}
            disabled={isEnhancing || !templateExplanation.trim()}
            className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
          >
            {isEnhancing ? 'Enhancing...' : 'Enhance with AI'}
          </button>
        </div>
      </div>

      {pastedImages.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
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
        <label className="block text-sm font-medium text-gray-700 mb-2">Video File</label>
        {preview ? (
          <div className="rounded-lg overflow-hidden bg-gray-100">
            <video 
              src={preview} 
              controls 
              className="w-full"
              style={{ maxHeight: '400px' }}
            >
              Your browser does not support the video tag.
            </video>
            <button
              type="button"
              onClick={() => {
                setFile(null)
                setPreview('')
              }}
              className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
            >
              Change Video
            </button>
          </div>
        ) : (
          <div
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 transition-colors
              ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
              hover:bg-gray-50`}
          >
            <div className="text-center">
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
                  <div className="text-gray-600">
                    <p className="font-medium">Drag and drop your video here, or click to select</p>
                    <p className="text-sm">MP4, WebM, or other video formats</p>
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || !file || !templateName}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Uploading...' : 'Upload Template'}
      </button>

      {error && (
        <div className="text-red-600 text-sm mt-2">{error}</div>
      )}
    </form>
  )
} 