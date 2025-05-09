'use client';

import { useState } from 'react';
import { MemeTemplate } from '@/lib/supabase/types';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'react-hot-toast';
import SpinningOrb from './SpinningOrb';
import BackgroundSVG from './BackgroundSVG';

interface AIMemeSelector {
  onSelectTemplate: (template: MemeTemplate, caption: string, allOptions: SelectedMeme) => void;
  isGreenscreenMode: boolean;
  onToggleMode: () => void;
}

interface AIResponse {
  templates: {
    template: number;
    captions: string[];
  }[];
}

interface SelectedMeme {
  templates: {
    template: MemeTemplate;
    captions: string[];
  }[];
  selectedTemplate?: MemeTemplate;
  selectedCaption?: string;
}

// Add type for template with indices
interface TemplateWithIndex extends MemeTemplate {
  originalIndex: number;
}

// Add this interface to properly type the template data from AI
interface TemplateResponse {
  template: number;
  captions: string[];
}

export default function AIMemeSelector({ onSelectTemplate, isGreenscreenMode, onToggleMode }: AIMemeSelector) {
  const supabase = createClient();
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [audience, setAudience] = useState('');
  const [selectedModel, setSelectedModel] = useState<'openai' | 'anthropic' | 'anthropic-3-5'>('anthropic-3-5');
  const [meme, setMeme] = useState<SelectedMeme | null>(null);
  const [showInitialForm, setShowInitialForm] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setShowInitialForm(false);
    try {
      // Get relevant templates using vector similarity
      const response = await fetch('/api/meme-selection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt,
          audience,
          isGreenscreenMode
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || 'Failed to get templates');
      }

      const { templates: fetchedTemplates } = await response.json();
      
      const templatesWithIndices = fetchedTemplates.map((template: MemeTemplate, index: number) => ({
        ...template,
        originalIndex: index + 1
      }));

      const templatesText = templatesWithIndices.map((template: MemeTemplate & { originalIndex: number }) => 
        `${template.originalIndex}. ${template.name}\nInstructions: ${template.instructions || 'No specific instructions'}`
      ).join('\n');

      console.log('=== DEBUG: Meme Generation Process ===');
      console.log('Prompt:', prompt);
      console.log('Audience:', audience || 'general audience');
      console.log('Greenscreen Mode:', isGreenscreenMode);
      console.log('Templates Count:', templatesWithIndices.length);
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
                content: `I want to create a meme with this idea: "${prompt}"\n\nAvailable templates:\n${templatesText}`,
                audience: audience || 'general audience'
              }]
            }),
          });
          
          if (openaiResponse.ok) {
            console.log('OpenAI template selection succeeded!');
            const data: AIResponse = await openaiResponse.json();
            
            // Map both templates to their full data
            const selectedTemplates = data.templates.map((templateData: TemplateResponse) => {
              const selectedTemplate = templatesWithIndices.find(
                (t: TemplateWithIndex) => t.originalIndex === templateData.template
              );
              
              if (!selectedTemplate) {
                throw new Error(`Could not find template ${templateData.template}`);
              }
              
              return {
                template: selectedTemplate,
                captions: templateData.captions
              };
            });
            
            setMeme({
              templates: selectedTemplates
            });
            return; // Exit early if successful
          }
          
          console.warn('OpenAI template selection failed, falling back to regular endpoint');
        } else {
          // Make API call for templates and captions using the tool-based endpoint
          const aiResponse = await fetch('/api/anthropic/tool-selection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{
                role: 'user',
                content: `I want to create a meme with this idea: "${prompt}"\n\nAvailable templates:\n${templatesText}`,
                audience: audience || 'general audience'
              }],
              model: selectedModel === 'anthropic-3-5' ? 'claude-3-5-sonnet-20241022' : 'claude-3-7-sonnet-20250219'
            }),
          });

          if (aiResponse.ok) {
            console.log('Tool-based template selection succeeded!');
            const data: AIResponse = await aiResponse.json();
            console.log('Tool-based response templates:', data.templates.length);
            
            // Map both templates to their full data
            const selectedTemplates = data.templates.map((templateData: TemplateResponse) => {
              console.log('Looking for template number:', templateData.template);
              console.log('Available templates:', templatesWithIndices.map((t: TemplateWithIndex) => ({
                index: t.originalIndex,
                name: t.name
              })));

              const selectedTemplate = templatesWithIndices.find(
                (t: TemplateWithIndex) => t.originalIndex === templateData.template
              );
              
              if (!selectedTemplate) {
                throw new Error(`Could not find template ${templateData.template}`);
              }

              console.log('Found template:', selectedTemplate.name);

              return {
                template: selectedTemplate,
                captions: templateData.captions
              };
            });

            console.log('Selected templates:', selectedTemplates.map(t => ({
              name: t.template.name,
              captions: t.captions
            })));

            setMeme({
              templates: selectedTemplates
            });
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
                content: `I want to create a meme with this idea: "${prompt}"\n\nAvailable templates:\n${templatesText}`,
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
                content: `I want to create a meme with this idea: "${prompt}"\n\nAvailable templates:\n${templatesText}`,
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
        const data: AIResponse = await fallbackResponse.json();
        console.log('Fallback response templates:', data.templates.length);
        
        // Map both templates to their full data
        const selectedTemplates = data.templates.map((templateData: TemplateResponse) => {
          console.log('Looking for template number:', templateData.template);
          console.log('Available templates:', templatesWithIndices.map((t: TemplateWithIndex) => ({
            index: t.originalIndex,
            name: t.name
          })));

          const selectedTemplate = templatesWithIndices.find(
            (t: TemplateWithIndex) => t.originalIndex === templateData.template
          );
          
          if (!selectedTemplate) {
            throw new Error(`Could not find template ${templateData.template}`);
          }

          console.log('Found template:', selectedTemplate.name);

          return {
            template: selectedTemplate,
            captions: templateData.captions
          };
        });

        console.log('Selected templates:', selectedTemplates.map(t => ({
          name: t.template.name,
          captions: t.captions
        })));

        setMeme({
          templates: selectedTemplates
        });
      } catch (error) {
        console.error('Error with fallback endpoint:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to generate meme');
        setShowInitialForm(true);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate meme');
      setShowInitialForm(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCaptionSelect = (template: MemeTemplate, caption: string) => {
    if (meme) {
      onSelectTemplate(template, caption, meme);
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
        <p className="mt-24 text-gray-300">Conjuring memes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showInitialForm ? (
        // Phase 1: Initial Form
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

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                checked={isGreenscreenMode}
                onChange={onToggleMode}
                className="w-4 h-4"
              />
              <span>Greenscreen Mode</span>
            </label>
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
            Generate with AI
          </button>
        </form>
      ) : meme && (
        // Phase 2 & 3: Generated Options
        <div className="grid gap-4 md:grid-cols-2">
          {meme.templates.map((templateData, templateIndex) => (
            <div key={templateIndex} className="p-4 border border-gray-700 rounded-lg bg-gray-800">
              <h3 className="font-medium mb-4 text-white">{templateData.template.name}</h3>
              
              <div className="space-y-3 mb-6">
                <h4 className="font-medium text-blue-400">Captions:</h4>
                {templateData.captions.map((caption, captionIndex) => (
                  <button
                    key={captionIndex}
                    onClick={() => handleCaptionSelect(templateData.template, caption)}
                    className="w-full p-3 text-left border border-gray-700 text-white rounded-lg hover:bg-gray-700 hover:border-blue-400 transition-colors flex items-center gap-2"
                  >
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-900 text-blue-300 text-sm">
                      {captionIndex + 1}
                    </span>
                    <span>{caption}</span>
                  </button>
                ))}
              </div>

              <div className="border border-gray-700 rounded-lg overflow-hidden">
                <video 
                  src={templateData.template.video_url}
                  className="w-full aspect-video object-cover"
                  controls
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 