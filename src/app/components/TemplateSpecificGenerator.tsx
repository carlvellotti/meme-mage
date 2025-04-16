'use client';

import { useState, useEffect, useRef } from 'react';
import { MemeTemplate } from '@/lib/supabase/types';
import { toast } from 'react-hot-toast';
import SpinningOrb from './SpinningOrb';
import BackgroundSVG from './BackgroundSVG';

interface TemplateSpecificGeneratorProps {
  template: MemeTemplate;
  onBack: () => void;
  onSelectTemplate: (template: MemeTemplate, caption: string, allOptions: SelectedMeme) => void;
  isGreenscreenMode: boolean;
  onInstructionsSaved?: (updatedTemplate: Partial<MemeTemplate>) => void;
}

interface SelectedMeme {
  templates: {
    template: MemeTemplate;
    captions: string[];
  }[];
  selectedTemplate?: MemeTemplate;
  selectedCaption?: string;
}

export default function TemplateSpecificGenerator({ 
  template, 
  onBack, 
  onSelectTemplate,
  isGreenscreenMode,
  onInstructionsSaved
}: TemplateSpecificGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [audience, setAudience] = useState('');
  const [selectedModel, setSelectedModel] = useState<'openai' | 'anthropic' | 'anthropic-3-5'>('anthropic-3-5');
  const [generatedCaptions, setGeneratedCaptions] = useState<string[]>([]);
  const [instructions, setInstructions] = useState(template.instructions || '');
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const [isSavingInstructions, setIsSavingInstructions] = useState(false);
  const [isInstructionsExpanded, setIsInstructionsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea when content changes or when editing mode is enabled
  useEffect(() => {
    if (isEditingInstructions && textareaRef.current) {
      const textarea = textareaRef.current;
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set the height to match the content
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [instructions, isEditingInstructions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    try {
      // Format the template for the AI prompt
      const templateWithIndex = {
        ...template,
        originalIndex: 1
      };
      
      const templateText = `1. ${template.name}\nInstructions: ${instructions || 'No specific instructions'}`;

      console.log('=== DEBUG: Template-Specific Meme Generation ===');
      console.log('Prompt:', prompt);
      console.log('Audience:', audience || 'general audience');
      console.log('Template:', template.name);
      console.log('Selected Model:', selectedModel);
      console.log('Model ID:', selectedModel === 'anthropic-3-5' ? 'claude-3-5-sonnet-20241022' : 'claude-3-7-sonnet-20250219');

      // Try the tool-based endpoint first
      try {
        console.log('Attempting tool-based template selection...');
        
        // If OpenAI is selected, use the OpenAI endpoint
        if (selectedModel === 'openai') {
          const openaiResponse = await fetch('/api/openai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{
                role: 'user',
                content: `I want to create a meme with this idea: "${prompt}"\n\nAvailable templates:\n${templateText}`,
                audience: audience || 'general audience'
              }]
            }),
          });
          
          if (openaiResponse.ok) {
            console.log('OpenAI template selection succeeded!');
            const data = await openaiResponse.json();
            
            // Extract captions from the response
            if (data.templates && data.templates.length > 0) {
              setGeneratedCaptions(data.templates[0].captions);
            }
            return; // Exit early if successful
          }
          
          console.warn('OpenAI template selection failed, falling back to regular endpoint');
        } else {
          // Make API call for captions using the tool-based endpoint
          const aiResponse = await fetch('/api/anthropic/tool-selection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{
                role: 'user',
                content: `I want to create a meme with this idea: "${prompt}"\n\nAvailable templates:\n${templateText}`,
                audience: audience || 'general audience'
              }],
              model: selectedModel === 'anthropic-3-5' ? 'claude-3-5-sonnet-20241022' : 'claude-3-7-sonnet-20250219'
            }),
          });

          if (aiResponse.ok) {
            console.log('Tool-based template selection succeeded!');
            const data = await aiResponse.json();
            console.log('Tool-based response templates:', data.templates.length);
            
            // Extract captions from the response
            if (data.templates && data.templates.length > 0) {
              setGeneratedCaptions(data.templates[0].captions);
            }
            return; // Exit early if successful
          }
          
          // If we get here, the tool-based endpoint failed
          console.warn('Tool-based template selection failed, falling back to regular endpoint');
        }
      } catch (error) {
        console.warn('Error with tool-based endpoint:', error);
        console.warn('Falling back to regular endpoint');
      }
      
      // Fallback to regular endpoint
      try {
        console.log('Using fallback (non-tool) endpoint for template selection...');
        
        let fallbackResponse;
        
        if (selectedModel === 'openai') {
          fallbackResponse = await fetch('/api/openai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{
                role: 'user',
                content: `I want to create a meme with this idea: "${prompt}"\n\nAvailable templates:\n${templateText}`,
                audience: audience || 'general audience'
              }]
            }),
          });
        } else {
          fallbackResponse = await fetch('/api/anthropic/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{
                role: 'user',
                content: `I want to create a meme with this idea: "${prompt}"\n\nAvailable templates:\n${templateText}`,
                audience: audience || 'general audience'
              }],
              model: selectedModel === 'anthropic-3-5' ? 'claude-3-5-sonnet-20241022' : 'claude-3-7-sonnet-20250219'
            }),
          });
        }
        
        if (!fallbackResponse.ok) {
          console.error('Fallback endpoint failed with status:', fallbackResponse.status);
          throw new Error('Failed to get AI response from fallback endpoint');
        }
        
        console.log('Fallback endpoint succeeded!');
        const data = await fallbackResponse.json();
        
        // Extract captions from the response
        if (data.templates && data.templates.length > 0) {
          setGeneratedCaptions(data.templates[0].captions);
        }
      } catch (error) {
        console.error('Error with fallback endpoint:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to generate captions');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate captions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCaptionSelect = (caption: string) => {
    // Create a structure similar to what the main generator produces
    const selectedMeme = {
      templates: [{
        template: template,
        captions: generatedCaptions
      }],
      selectedTemplate: template,
      selectedCaption: caption
    };
    
    onSelectTemplate(template, caption, selectedMeme);
  };

  const saveInstructions = async () => {
    setIsSavingInstructions(true);
    try {
      console.log('Saving instructions for template:', template.id);
      console.log('Instructions content:', instructions);
      
      const response = await fetch(`/api/templates/${template.id}/update-instructions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Error response:', response.status, errorData);
        throw new Error(`Failed to update instructions: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Update successful:', data);
      
      // Call the callback with the updated data from the API response
      if (onInstructionsSaved && data.data) {
        onInstructionsSaved(data.data);
      }

      toast.success('Template instructions updated');
      setIsEditingInstructions(false);
    } catch (error) {
      console.error('Error saving instructions:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update instructions');
    } finally {
      setIsSavingInstructions(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-2 relative">
        <div className="relative">
          <BackgroundSVG width={300} height={300} />
          <div style={{ marginTop: '-30px' }}>
            <SpinningOrb width={240} height={240} color={{ r: 70, g: 140, b: 255 }} />
          </div>
        </div>
        <p className="mt-24 text-gray-500">Generating captions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Template Preview */}
      <div className="border border-gray-700 rounded-lg overflow-hidden mb-6">
        <video 
          src={template.video_url}
          className="w-full aspect-video object-cover"
          controls
        />
      </div>
      
      {/* Template Instructions Editor */}
      <div className="border border-gray-700 rounded-lg p-3 bg-gray-800 mb-6">
        <div className="flex justify-between items-center mb-1">
          <h4 className="font-medium text-white text-sm">Template Instructions</h4>
          <div className="flex space-x-2">
            {!isEditingInstructions && instructions && (
              <button
                onClick={() => setIsInstructionsExpanded(!isInstructionsExpanded)}
                className="px-2 py-1 bg-gray-700 text-white rounded-md text-xs hover:bg-gray-600"
              >
                {isInstructionsExpanded ? 'Collapse' : 'Expand'}
              </button>
            )}
            {isEditingInstructions ? (
              <div className="space-x-2">
                <button 
                  onClick={saveInstructions}
                  disabled={isSavingInstructions}
                  className="px-2 py-1 bg-green-600 text-white rounded-md text-xs"
                >
                  {isSavingInstructions ? 'Saving...' : 'Save'}
                </button>
                <button 
                  onClick={() => {
                    setInstructions(template.instructions || '');
                    setIsEditingInstructions(false);
                  }}
                  className="px-2 py-1 bg-gray-600 text-white rounded-md text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsEditingInstructions(true)}
                className="px-2 py-1 bg-blue-600 text-white rounded-md text-xs"
              >
                Edit
              </button>
            )}
          </div>
        </div>
        
        {isEditingInstructions ? (
          <>
            <textarea
              ref={textareaRef}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full p-3 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500"
              style={{ minHeight: '100px' }}
              placeholder="Add instructions for how this template should be used..."
            />
            <p className="text-xs text-gray-400 mt-2">
              Uploader: {template.uploader_name || 'N/A'}
            </p>
          </>
        ) : (
          <div className="relative">
            <p className="text-gray-300 p-2 border border-gray-700 rounded-md bg-gray-700 overflow-hidden text-sm" 
               style={{ maxHeight: isInstructionsExpanded ? 'none' : '40px', transition: 'max-height 0.3s ease' }}>
              {instructions || 'No instructions provided.'}
            </p>
            {!isInstructionsExpanded && instructions && instructions.length > 60 && (
              <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-gray-700 to-transparent"></div>
            )}
          </div>
        )}
      </div>
      
      {/* Caption Generation Form */}
      {generatedCaptions.length === 0 ? (
        <div className="border border-gray-700 rounded-lg p-4 bg-gray-800">
          <h2 className="text-xl font-bold text-white mb-4">Create Meme from Template</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Target Audience
              </label>
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full p-3 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Software developers, gamers, crypto traders..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Describe your meme idea
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                className="w-full p-3 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Describe what kind of meme you want to create... (Press Enter to submit, Shift+Enter for new line)"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select AI Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as 'openai' | 'anthropic' | 'anthropic-3-5')}
                className="w-full p-2 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="anthropic-3-5">Claude 3.5 Sonnet</option>
                <option value="anthropic">Claude 3.7 Sonnet</option>
                <option value="openai">GPT-4</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={!prompt.trim()}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              Generate Captions
            </button>
          </form>
        </div>
      ) : (
        // Caption Selection UI
        <div className="border border-gray-700 rounded-lg p-4 bg-gray-800">
          <h3 className="font-medium mb-4 text-white">Select a Caption:</h3>
          <div className="space-y-3">
            {generatedCaptions.map((caption, index) => (
              <button
                key={index}
                onClick={() => handleCaptionSelect(caption)}
                className="w-full p-3 text-left border border-gray-700 rounded-lg hover:bg-gray-700 hover:border-blue-500 transition-colors flex items-center gap-2 text-white"
              >
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-900 text-blue-300 text-sm">
                  {index + 1}
                </span>
                <span>{caption}</span>
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setGeneratedCaptions([])}
            className="mt-4 w-full py-2 px-4 bg-gray-700 text-white rounded-md hover:bg-gray-600"
          >
            Generate New Captions
          </button>
        </div>
      )}
    </div>
  );
} 