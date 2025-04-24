'use client';

import { useState } from 'react';
import { MemeTemplate } from '@/lib/supabase/types'; // Assuming this type exists
import MemeGenerator from '@/app/components/MemeGenerator'; // Assuming this component exists
import { getCaptionGenerationTestPrompt } from "@/lib/utils/prompts";
import toast from 'react-hot-toast';

// Define the structure for storing results per template/model
export interface MemeOption {
  template: MemeTemplate;
  modelCaptions: {
    modelId: string; // e.g., 'claude-3-7-sonnet', 'gemini-2.5-pro', 'grok-llama3'
    captions: string[];
    error?: string | null;
    latency?: number; // Optional
  }[];
}

// Interface for caption generation result
interface CaptionGenerationResult {
  templateId: string | number;
  modelId: string;
  captions: string[];
  error?: string | null;
  latency?: number;
}

// Import or define the SelectedMeme interface to match MemeGenerator's expectation
interface SelectedMeme {
  templates: {
    template: MemeTemplate;
    captions: string[];
  }[];
}

// Helper function to get model display name
const getModelDisplayName = (modelId: string) => {
  switch (modelId) {
    case "anthropic-3.5":
      return "Claude 3.5";
    case "anthropic-3.7":
      return "Claude 3.7";
    case "google-gemini-2.5-pro":
      return "Gemini 2.5";
    case "grok-3-latest":
      return "Grok 3";
    default:
      return modelId;
  }
};

export default function MemeSelectorV2() {
  // --- State Variables --- 
  const [audience, setAudience] = useState<string>('');
  const [userPrompt, setUserPrompt] = useState<string>(''); // Optional prompt
  const [isLoadingTemplates, setIsLoadingTemplates] = useState<boolean>(false);
  const [isLoadingCaptions, setIsLoadingCaptions] = useState<boolean>(false);
  const [fetchedTemplates, setFetchedTemplates] = useState<MemeTemplate[] | null>(null);
  const [memeOptions, setMemeOptions] = useState<MemeOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFinalTemplate, setSelectedFinalTemplate] = useState<MemeTemplate | null>(null);
  const [selectedFinalCaption, setSelectedFinalCaption] = useState<string | null>(null);

  // State for final selection passed to MemeGenerator 
  const [optionsForGenerator, setOptionsForGenerator] = useState<MemeOption[] | null>(null);

  // Generate captions for all templates using multiple models
  const generateCaptionsForAllTemplates = async (templates: MemeTemplate[]) => {
    if (!templates || templates.length === 0) return;
    
    // Set loading state
    setIsLoadingCaptions(true);
    
    // Define target models - Updated to match the backend expected format
    const models = [
      'anthropic-3.5', 
      'anthropic-3.7', 
      'google-gemini-2.5-pro',
      'grok-3-latest'
    ];
    
    // Initialize results structure with placeholders
    const initialOptions: MemeOption[] = templates.map(template => ({
      template,
      modelCaptions: models.map(modelId => ({ 
        modelId, 
        captions: [], 
        error: undefined 
      }))
    }));
    
    // Set initial structure immediately for UI updates
    setMemeOptions(initialOptions);
    
    // Prepare array for all API call promises
    const captionPromises = [];
    
    // Loop through templates and models
    for (const template of templates) {
      for (const modelId of models) {
        // Use the imported prompt utility function
        const systemPrompt = getCaptionGenerationTestPrompt(audience || "general");
        const userMessage = `User Prompt: "${userPrompt || "Create captions for this meme template"}"\n\nTemplate Name: ${template.name}\nTemplate Instructions: ${template.instructions || 'None'}`;
        
        // Prepare request body for the AI API
        const apiRequestBody = {
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7
        };
        
        // Create the fetch promise
        const promise = fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_AI_API_SECRET_TOKEN || 'carl'}`
          },
          body: JSON.stringify(apiRequestBody)
        })
        .then(async response => {
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Generation failed');
          }
          
          const startTime = Date.now();
          const result = await response.json();
          const latency = Date.now() - startTime;
          
          let captions: string[] = [];
          try {
            // The API returns { response: "..." } instead of { captions: [...] }
            const responseText = result.response;
            
            // Sometimes models wrap JSON in markdown code blocks
            let jsonString = responseText;
            if (jsonString.includes('```')) {
              // Extract content between code blocks if present
              const match = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
              if (match && match[1]) {
                jsonString = match[1].trim();
              }
            }
            
            // Try to parse JSON
            const parsedContent = JSON.parse(jsonString);
            
            // Expected format is {"captions": ["caption1", "caption2", ...]}
            if (parsedContent.captions && Array.isArray(parsedContent.captions)) {
              captions = parsedContent.captions;
            } else if (Array.isArray(parsedContent)) {
              captions = parsedContent;
            } else {
              throw new Error("Unexpected response format");
            }
            
            // Take up to 5 captions (the prompt asks for 5)
            captions = captions.slice(0, 5);
          } catch (e: any) { // Catch specific error types if needed
            console.error("Error parsing captions:", e);
            captions = []; // Keep captions empty on error
            return { // Return error in the result object
              templateId: template.id, 
              modelId, 
              captions: [], 
              error: e.message || "Failed to parse response",
              latency 
            } as CaptionGenerationResult;
          }
          
          return { 
            templateId: template.id, 
            modelId, 
            captions, 
            error: undefined,
            latency 
          } as CaptionGenerationResult;
        })
        .catch(error => {
          console.error(`Error fetching captions for ${template.name} from ${modelId}:`, error);
          return { 
            templateId: template.id, 
            modelId, 
            captions: [], 
            error: error.message || 'Generation failed' 
          } as CaptionGenerationResult;
        });
        
        captionPromises.push(promise);
      }
    }
    
    // Execute promises in parallel
    const results = await Promise.allSettled(captionPromises);
    
    // Process results and update state
    const finalOptions = [...initialOptions]; // Create a mutable copy
    
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        const { templateId, modelId, captions, error, latency } = result.value;
        
        // Find the corresponding template and model
        const templateIndex = finalOptions.findIndex(opt => opt.template.id === templateId);
        if (templateIndex >= 0) {
          const modelIndex = finalOptions[templateIndex].modelCaptions.findIndex(
            m => m.modelId === modelId
          );
          
          if (modelIndex >= 0) {
            // Update with captions or error
            finalOptions[templateIndex].modelCaptions[modelIndex] = {
              modelId,
              captions: error ? [] : captions,
              error: error || undefined, // Assign error or undefined
              latency
            };
          }
        }
      } else {
        // Handle rejected promises (network errors, etc.) - This part was missing!
        console.error("Caption generation promise rejected:", result.reason);
        // We might need to find which template/model this rejection belonged to
        // This requires a more complex mapping or passing IDs within the promise context
        // For now, we don't update state for rejected promises, but log the error.
      }
    });
    
    // Update state with all results
    setMemeOptions(finalOptions);
    
    // Clear loading state
    setIsLoadingCaptions(false);
  };

  // --- Event Handlers --- 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous results and errors
    setMemeOptions(null);
    setError(null);
    setFetchedTemplates(null);
    
    // Set loading state
    setIsLoadingTemplates(true);
    
    // Prepare request body
    const requestBody = {
      count: 3,
      audience: audience.trim() || undefined, // Send audience if provided
      prompt: userPrompt.trim() || undefined, // Send prompt ONLY if provided
      // Add isGreenscreenMode if needed later
    };
    
    try {
      // Call the backend API
      const response = await fetch('/api/templates/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      // Handle response
      if (response.ok) {
        const data = await response.json();
        if (data.templates && data.templates.length > 0) {
            setFetchedTemplates(data.templates);
            // Trigger caption generation now that we have templates
            generateCaptionsForAllTemplates(data.templates);
        } else {
            setError('No templates found matching your criteria.');
            setFetchedTemplates([]); // Set to empty array to stop loading
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch templates');
      }
    } catch (err: any) { // Catch specific error types if needed
      // Handle network errors
      console.error('Error fetching templates:', err);
      setError(err.message || 'Network error. Please try again.');
    } finally {
      // Clear loading state regardless of outcome
      setIsLoadingTemplates(false);
    }
  };

  const handleSelectCaption = (template: MemeTemplate, caption: string) => {
    console.log('Caption selected:', { templateName: template.name, caption });
    setSelectedFinalTemplate(template);
    setSelectedFinalCaption(caption);
    // Store the full options to pass to MemeGenerator for the "Other Options" section
    setOptionsForGenerator(memeOptions);
  };

  // Convert MemeOption[] to SelectedMeme format for MemeGenerator
  const convertToSelectedMemeFormat = (options: MemeOption[] | null): SelectedMeme | undefined => {
    if (!options) return undefined;
    
    return {
      templates: options.map(option => {
        // Flatten captions from all models into a single array
        const allCaptions = option.modelCaptions.flatMap(model => 
          model.captions || []
        );
        
        return {
          template: option.template,
          captions: allCaptions
        };
      })
    };
  };

  // --- Rendering Logic --- 

  // Render MemeGenerator when template and caption are selected
  if (selectedFinalTemplate && selectedFinalCaption) {
    return (
      <MemeGenerator
        initialTemplate={selectedFinalTemplate}
        initialCaption={selectedFinalCaption}
        initialOptions={convertToSelectedMemeFormat(memeOptions)}
        isGreenscreenMode={false} // Pass the actual mode if needed
        onToggleMode={() => {}} // Implement if needed
        onBack={() => {
          setSelectedFinalTemplate(null);
          setSelectedFinalCaption(null);
        }}
      />
    );
  }

  // --- Main Component Return --- 
  return (
    <div className="w-full mx-auto p-4">
      {/* Global Error Display */}
      {error && !isLoadingTemplates && !isLoadingCaptions && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded" role="alert">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Initial Form - Show if no results yet and not loading */}
      {!memeOptions && !isLoadingTemplates && !isLoadingCaptions && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8 mx-auto" style={{ maxWidth: '600px' }}> 
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Target Audience (Optional)
              </label>
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full p-2 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Software developers, cat lovers..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Describe your meme idea (Optional)
              </label>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                className="w-full p-2 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="If you have an idea, describe it here... Otherwise, we'll pick random templates."
              />
              <p className="text-xs text-gray-400 mt-1">Leave blank for random templates.</p>
            </div>
            <button
              type="submit"
              disabled={isLoadingTemplates}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoadingTemplates ? 'Fetching Templates...' : 'Generate Meme Options'}
            </button>
          </form>
        </div>
      )}

      {/* Loading Indicator - Show only during caption generation (template loading handled by button state) */}
      {isLoadingCaptions && (
         <div className="flex flex-col justify-center items-center p-10 space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-t-2 border-indigo-400"></div>
            <p className="text-gray-300">Generating captions from AI models...</p>
        </div>
      )}

      {/* Results Columns - Show when options are loaded and not generating captions */}
      {memeOptions && !isLoadingCaptions && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-100 mb-4 text-center">Generated Options</h2>
          {/* Use flexbox with wrapping for columns */}
          <div className="flex flex-wrap justify-center gap-6 pb-4">
            {memeOptions.map((option) => (
              // Each child is a column representing one template
              <div key={option.template.id} className="w-full sm:w-[45%] md:w-[40%] lg:w-[30%] bg-gray-800 rounded-lg shadow-md p-4 border border-gray-700 flex flex-col" style={{ minWidth: '300px' }}> 
                <h3 className="font-medium text-lg mb-2 text-white">{option.template.name}</h3>
                
                {/* Template video */} 
                <div className="mb-4 bg-gray-900 rounded flex-shrink-0">
                  {option.template.video_url ? (
                    <video
                      src={option.template.video_url}
                      className="w-full rounded"
                      controls
                      loop
                      muted
                      playsInline // Good for mobile
                    />
                  ) : (
                    <div className="w-full h-44 flex items-center justify-center bg-gray-700 rounded">
                      <p className="text-gray-400">Video not available</p>
                    </div>
                  )}
                </div>

                {/* Grouped and Numbered Captions - No vertical scroll */}
                <div className="space-y-4 flex-grow">
                  {option.modelCaptions.map((modelCaption) => (
                    <div key={modelCaption.modelId}>
                      <h4 className="font-medium text-blue-400 mb-2 flex items-center">
                        {getModelDisplayName(modelCaption.modelId)} Captions
                        {typeof modelCaption.latency === 'number' && (
                          <span className="ml-2 text-xs text-gray-500">
                            ({(modelCaption.latency / 1000).toFixed(1)}s)
                          </span>
                        )}
                      </h4>
                      
                      {modelCaption.error && (
                        <div className="bg-red-900 border border-red-700 p-2 rounded text-sm text-red-300 mb-2">
                          Error: {modelCaption.error}
                        </div>
                      )}

                      {modelCaption.captions.length === 0 && !modelCaption.error && (
                         <div className="p-2 text-sm text-gray-400 animate-pulse mb-2">
                           Generating...
                         </div>
                      )}

                      {modelCaption.captions.length > 0 && (
                        <div className="space-y-2">
                          {modelCaption.captions.map((caption, index) => (
                            <button
                              key={index}
                              onClick={() => handleSelectCaption(option.template, caption)}
                              className="w-full text-left p-3 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors duration-150 hover:border-blue-500 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-gray-800 flex items-start gap-2"
                              title="Select this caption"
                            >
                              <span className="flex-shrink-0 w-5 h-5 mt-0.5 flex items-center justify-center rounded-full bg-blue-900 text-blue-300 text-xs font-semibold">
                                {index + 1}
                              </span>
                              <span className="flex-grow">{caption}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
           {/* Back Button */} 
           <button 
              onClick={() => { setMemeOptions(null); setFetchedTemplates(null); setError(null); }} 
              className="mt-6 py-2 px-4 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors block mx-auto"
            >
             &larr; Back to Form
            </button>
        </div>
      )}
    </div>
  );
} 