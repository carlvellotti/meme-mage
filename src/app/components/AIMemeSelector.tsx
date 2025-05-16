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
    setMeme(null); // Reset previous meme output
    console.log('[AIMemeSelector] Submitting - Prompt:', prompt, 'Audience:', audience, 'Greenscreen:', isGreenscreenMode);

    try {
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
        toast.error(errorData.error || errorData.details || 'Failed to get initial templates');
        throw new Error(errorData.error || errorData.details || 'Failed to get templates');
      }

      const { templates: fetchedTemplates } = await response.json();
      console.log('[AIMemeSelector] Received initial templates from API:', fetchedTemplates.map((t: MemeTemplate) => ({id: t.id, name: t.name})));

      if (!fetchedTemplates || fetchedTemplates.length === 0) {
        toast.error("No suitable templates found for your idea. Try a different prompt!");
        setShowInitialForm(true);
        setIsLoading(false);
        return;
      }
      
      const templatesWithIndices = fetchedTemplates.map((template: MemeTemplate, index: number) => ({
        ...template,
        originalIndex: index + 1
      }));

      const templatesText = templatesWithIndices.map((template: MemeTemplate & { originalIndex: number }) => 
        `${template.originalIndex}. ${template.name}\nInstructions: ${template.instructions || 'No specific instructions'}`
      ).join('\n');

      console.log('[AIMemeSelector] DEBUG: Meme Generation Process Start');
      console.log('[AIMemeSelector] User Prompt:', prompt);
      console.log('[AIMemeSelector] Target Audience:', audience || 'general audience');
      console.log('[AIMemeSelector] Greenscreen Mode:', isGreenscreenMode);
      console.log('[AIMemeSelector] Number of initial templates for AI:', templatesWithIndices.length);
      console.log('[AIMemeSelector] Selected AI Model for captioning:', selectedModel);
      // Model ID logic seems specific to older Claude versions, adjust if necessary for current setup
      // console.log('[AIMemeSelector] Model ID for API:', selectedModel === 'anthropic-3-5' ? 'claude-3-5-sonnet-20241022' : 'claude-3-7-sonnet-20250219'); 

      // Tool-based selection / captioning logic (Anthropic or OpenAI)
      let aiApiResponse: Response;
      const messagesForAI = [{
        role: 'user',
        content: `I want to create a meme with this idea: "${prompt}"\n\nAvailable templates:\n${templatesText}`,
        audience: audience || 'general audience'
      }];

      if (selectedModel === 'openai') {
        console.log('[AIMemeSelector] Calling OpenAI for caption generation...');
        aiApiResponse = await fetch('/api/openai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: messagesForAI }), // Ensure this matches /api/openai/chat expected structure
        });
      } else { // 'anthropic' or 'anthropic-3-5'
        const modelForAnthropic = selectedModel === 'anthropic-3-5' ? 'claude-3-5-sonnet-20240620' : 'claude-3-opus-20240229'; // Example model IDs, ensure they are current
        console.log(`[AIMemeSelector] Calling Anthropic (${modelForAnthropic}) for caption generation...`);
        // Assuming /api/anthropic/tool-selection is the correct endpoint for tool use
        aiApiResponse = await fetch('/api/anthropic/tool-selection', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messagesForAI,
            model: modelForAnthropic 
          }),
        });
      }
          
      if (!aiApiResponse.ok) {
        const errorData = await aiApiResponse.json();
        toast.error(errorData.error || 'AI caption generation failed');
        throw new Error(errorData.error || 'AI caption generation failed');
      }
            
      const data: AIResponse = await aiApiResponse.json();
      console.log('[AIMemeSelector] AI Response (selected templates and captions):', data);
            
      const finalSelectedTemplates = data.templates.map((templateData: TemplateResponse) => {
        const foundTemplate = templatesWithIndices.find(
          (t: TemplateWithIndex) => t.originalIndex === templateData.template
        );
        if (!foundTemplate) {
          console.error(`[AIMemeSelector] Critical Error: AI chose template index ${templateData.template} which was not in the initial list.`);
          // Fallback or skip this template if not found
          return null; 
        }
        return {
          template: foundTemplate,
          captions: templateData.captions
        };
      }).filter(t => t !== null) as { template: MemeTemplate; captions: string[] }[]; // Filter out nulls and assert type

      if (finalSelectedTemplates.length === 0 && data.templates.length > 0) {
        toast.error("AI selected templates not found in the initial list. Please try again.");
        setShowInitialForm(true);
        setIsLoading(false);
        return;
      }
      
      console.log('[AIMemeSelector] Final processed selections for display:', finalSelectedTemplates.map(st => ({ name: st.template.name, captions: st.captions })));
      setMeme({
        templates: finalSelectedTemplates
      });

    } catch (error) {
      console.error('[AIMemeSelector] Error in handleSubmit:', error);
      // Check if error is an instance of Error before accessing message property
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      // Toast error only if it hasn't been handled by more specific toasts above
      if (!((error instanceof Error && error.message.includes('Failed to get initial templates')) || 
            (error instanceof Error && error.message.includes('AI caption generation failed')))){
        toast.error(errorMessage);
      }
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
              {/* <option value="anthropic">Claude 3 Opus</option> */}
              {/* Consider updating available models based on current API capabilities */}
              <option value="anthropic">Claude 3 Opus / Latest Sonnet via Tool Use</option> 
              <option value="openai">GPT-4 (OpenAI)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={!prompt.trim() || isLoading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating...' : 'Generate with AI'}
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
           {meme.templates.length > 0 && (
            <button 
              onClick={() => {setShowInitialForm(true); setMeme(null);}} 
              className="md:col-span-2 w-full mt-4 py-2 px-4 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Start Over
            </button>
          )}
        </div>
      )}
      {isLoading && !meme && (
         <div className="flex flex-col items-center justify-center py-2 relative">
            <div className="relative">
              <BackgroundSVG width={300} height={300} />
              <div style={{ marginTop: '-30px' }}>
                <SpinningOrb width={240} height={240} color={{ r: 70, g: 140, b: 255 }} />
              </div>
            </div>
            <p className="mt-24 text-gray-300">Conjuring memes...</p>
        </div>
      )}
    </div>
  );
} 