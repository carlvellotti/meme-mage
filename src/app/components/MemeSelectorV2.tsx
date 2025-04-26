'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr'; // Import useSWR
import { MemeTemplate } from '@/lib/supabase/types'; // Assuming this type exists
import MemeGenerator from '@/app/components/MemeGenerator'; // Assuming this component exists
import { getCaptionGenerationTestPrompt } from "@/lib/utils/prompts";
import toast from 'react-hot-toast';
import PersonaManager from './PersonaManager'; // Import PersonaManager
import CaptionRuleManager from './CaptionRuleManager'; // Import CaptionRuleManager

// --- localStorage Keys ---
const LOCALSTORAGE_PERSONA_ID_KEY = 'memeSelectorV2_selectedPersonaId';
const LOCALSTORAGE_RULE_SET_ID_KEY = 'memeSelectorV2_selectedRuleSetId';

// Define the Persona type (should match PersonaManager)
interface Persona {
  id: string;
  name: string;
  description?: string | null;
}

// Define the Caption Rule interface (should match CaptionRuleManager)
interface CaptionRule {
  id: string;
  name: string;
  rules_text: string;
  // Add other fields if needed from the DB schema
}

// Fetcher function (can be moved to a shared util)
const fetcher = (url: string) => fetch(url).then(async (res) => {
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'An error occurred');
  }
  const result = await res.json();
  return result.data;
});

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
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(''); // Store selected persona ID
  const [selectedRuleSetId, setSelectedRuleSetId] = useState<string>(''); // Store selected rule set ID ('' for default)
  const [userPrompt, setUserPrompt] = useState<string>(''); // Optional prompt
  const [isGreenscreenMode, setIsGreenscreenMode] = useState<boolean>(false); // Greenscreen mode state
  const [isLoadingTemplates, setIsLoadingTemplates] = useState<boolean>(false);
  const [isLoadingCaptions, setIsLoadingCaptions] = useState<boolean>(false);
  const [fetchedTemplates, setFetchedTemplates] = useState<MemeTemplate[] | null>(null);
  const [memeOptions, setMemeOptions] = useState<MemeOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFinalTemplate, setSelectedFinalTemplate] = useState<MemeTemplate | null>(null);
  const [selectedFinalCaption, setSelectedFinalCaption] = useState<string | null>(null);
  const [optionsForGenerator, setOptionsForGenerator] = useState<MemeOption[] | null>(null);
  
  // State for Persona Manager Modal
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  // State for Caption Rule Manager Modal
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);

  // State to track loading for feedback from options cards
  const [optionFeedbackLoading, setOptionFeedbackLoading] = useState<Record<string, boolean>>({});

  // --- Data Fetching with SWR --- 
  const { 
    data: personas, 
    error: personasError, 
    isLoading: isLoadingPersonas 
  } = useSWR<Persona[]>('/api/personas', fetcher);

  // Fetch Caption Rule Sets
  const { 
    data: captionRuleSets, 
    error: ruleSetsError, 
    isLoading: isLoadingRuleSets 
  } = useSWR<CaptionRule[]>('/api/caption-rules', fetcher);

  // --- Effects --- 

  // Effect to load saved selections from localStorage on mount
  useEffect(() => {
    const savedPersonaId = localStorage.getItem(LOCALSTORAGE_PERSONA_ID_KEY);
    const savedRuleSetId = localStorage.getItem(LOCALSTORAGE_RULE_SET_ID_KEY);
    if (savedPersonaId) {
      setSelectedPersonaId(savedPersonaId);
    }
    if (savedRuleSetId) {
      setSelectedRuleSetId(savedRuleSetId);
    }
    // Run only once on mount
  }, []); 

  // Effect to save selected persona ID to localStorage
  useEffect(() => {
    if (selectedPersonaId) {
      localStorage.setItem(LOCALSTORAGE_PERSONA_ID_KEY, selectedPersonaId);
    } else {
      // Remove if deselected (though current UI doesn't allow direct deselection)
      localStorage.removeItem(LOCALSTORAGE_PERSONA_ID_KEY);
    }
  }, [selectedPersonaId]);

  // Effect to save selected rule set ID to localStorage
  useEffect(() => {
    if (selectedRuleSetId) {
      localStorage.setItem(LOCALSTORAGE_RULE_SET_ID_KEY, selectedRuleSetId);
    } else {
      // If empty string (Default Rules), remove from storage
      localStorage.removeItem(LOCALSTORAGE_RULE_SET_ID_KEY);
    }
  }, [selectedRuleSetId]);

  // Effect to handle zero personas case
  useEffect(() => {
      // Open modal automatically if loading is done, no error, and personas array is empty
      if (!isLoadingPersonas && !personasError && personas?.length === 0 && !isPersonaModalOpen) {
          toast.error('Please create a Persona first to generate memes.');
          setIsPersonaModalOpen(true);
      }
  }, [isLoadingPersonas, personasError, personas, isPersonaModalOpen]);

  // Generate captions for all templates using multiple models
  const generateCaptionsForAllTemplates = async (templates: MemeTemplate[]) => {
    if (!templates || templates.length === 0) return;
    
    setIsLoadingCaptions(true);
    setMemeOptions(null); // Clear old options

    // Find selected persona's name and description for the prompt context
    const selectedPersona = personas?.find(p => p.id === selectedPersonaId);
    const audienceName = selectedPersona ? selectedPersona.name : "general audience"; // Fallback name
    const audienceDescription = selectedPersona ? selectedPersona.description : null; // Description or null
    
    // --- Determine the rules text to use --- 
    const selectedRuleSet = captionRuleSets?.find(rule => rule.id === selectedRuleSetId);
    const customRulesText = selectedRuleSet?.rules_text; // Will be undefined if default ('') is selected
    
    // --- Get System Prompt using the determined rules and audience details --- 
    const systemPrompt = getCaptionGenerationTestPrompt(audienceName, audienceDescription, customRulesText);
    // -----------------------------------------------------

    // <<< Add Detailed Logging Here >>>
    console.log(`--- Generating Captions ---`);
    console.log(`Template: ${templates[0].name} (ID: ${templates[0].id})`); // Log the first template name for context
    console.log(`Model: ${'anthropic-3.5'}`); // Log the first model for context
    console.log(`Audience Name: ${audienceName}`);
    console.log(`Audience Description: ${audienceDescription || '(None provided)'}`);
    console.log(`Custom Rules Text Used:`, customRulesText || '(Default Rules)'); 
    console.log(`System Prompt (Start): ${systemPrompt.substring(0, 300)}...`); 
    console.log(`System Prompt (End): ...${systemPrompt.substring(systemPrompt.length - 300)}`); 
    // console.log("Full System Prompt:", systemPrompt); // Uncomment if full prompt needed

    const models = [
      'anthropic-3.5',
      'anthropic-3.7',
      'google-gemini-2.5-pro',
      'grok-3-latest'
    ];
    
    const initialOptions: MemeOption[] = templates.map(template => ({
      template,
      modelCaptions: models.map(modelId => ({ modelId, captions: [], error: undefined }))
    }));
    setMemeOptions(initialOptions);
    
    const captionPromises = [];
    
    for (const template of templates) {
      for (const modelId of models) {
        // systemPrompt is now determined above the loops
        const userMessage = `User Prompt: "${userPrompt || "Create captions for this meme template"}"\n\nTemplate Name: ${template.name}\nTemplate Instructions: ${template.instructions || 'None'}`;
        
        const apiRequestBody = {
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt }, // Using the dynamically determined prompt
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7
        };
        
        const promise = fetch('/api/ai/chat', { // Auth is handled via cookie by browser
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiRequestBody)
        })
        .then(async response => {
          const startTime = Date.now(); // Start timer after fetch call begins resolving
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
          }
          const result = await response.json();
          const latency = Date.now() - startTime;
          
          let captions: string[] = [];
          try {
            const responseText = result.response;
            let jsonString = responseText;
            if (jsonString.includes('```')) {
              const match = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
              if (match && match[1]) jsonString = match[1].trim();
            }
            const parsedContent = JSON.parse(jsonString);
            
            if (parsedContent.captions && Array.isArray(parsedContent.captions)) {
              captions = parsedContent.captions;
            } else if (Array.isArray(parsedContent)) {
              captions = parsedContent;
            } else {
              throw new Error("Unexpected response format from AI");
            }
            captions = captions.slice(0, 5);
          } catch (e: any) {
            console.error("Error parsing captions:", e);
            return { 
              templateId: template.id, modelId, captions: [], 
              error: e.message || "Failed to parse AI response", latency 
            } as CaptionGenerationResult;
          }
          return { templateId: template.id, modelId, captions, error: undefined, latency } as CaptionGenerationResult;
        })
        .catch(error => {
          console.error(`Error fetching captions for ${template.name} from ${modelId}:`, error);
          return { templateId: template.id, modelId, captions: [], error: error.message || 'Generation failed' } as CaptionGenerationResult;
        });
        captionPromises.push(promise);
      }
    }
    
    const results = await Promise.allSettled(captionPromises);
    
    const finalOptions = [...initialOptions]; 
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
         const { templateId, modelId, captions, error, latency } = result.value;
         const templateIndex = finalOptions.findIndex(opt => opt.template.id === templateId);
         if (templateIndex >= 0) {
           const modelIndex = finalOptions[templateIndex].modelCaptions.findIndex(m => m.modelId === modelId);
           if (modelIndex >= 0) {
             finalOptions[templateIndex].modelCaptions[modelIndex] = { modelId, captions: error ? [] : captions, error: error || undefined, latency };
           }
         }
      } else if (result.status === 'rejected') {
          // Handle rejected promises if necessary (e.g., log which specific call failed)
         console.error("A caption generation promise was rejected:", result.reason);
         // Potentially find the corresponding template/model in initialOptions and mark with a generic network error
      }
    });
    setMemeOptions(finalOptions);
    setIsLoadingCaptions(false);
  };

  // <<< New Feedback Handler for Options Cards >>>
  const handleFeedbackFromOptions = async (templateId: string, status: 'used' | 'dont_use') => {
    if (!selectedPersonaId) {
      toast.error('Please select a persona before providing feedback.');
      return;
    }
    
    setOptionFeedbackLoading(prev => ({ ...prev, [templateId]: true }));
    const toastId = toast.loading('Saving feedback...');

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          template_id: templateId, 
          persona_id: selectedPersonaId, 
          status 
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to save feedback');

      toast.success(`Feedback saved!`, { id: toastId });
      // Optionally, update UI within the card to show feedback was given

    } catch (err: any) {
      console.error("Feedback Error from Options:", err); // Corrected console log context
      toast.error(err.message || 'Could not save feedback.', { id: toastId });
    } finally {
      setOptionFeedbackLoading(prev => ({ ...prev, [templateId]: false }));
    }
  };

  // --- Event Handlers --- 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Require Persona selection
    if (!selectedPersonaId) {
        toast.error('Please select a Persona first.');
        // Optionally open the modal if none exist or are selected
        if (!personas || personas.length === 0) {
            setIsPersonaModalOpen(true);
        }
        return;
    }
    
    setMemeOptions(null);
    setError(null);
    setFetchedTemplates(null);
    setIsLoadingTemplates(true);
    
    const requestBody = {
      count: 3,
      prompt: userPrompt.trim() || undefined,
      persona_id: selectedPersonaId,
      isGreenscreenMode: isGreenscreenMode,
    };
    
    try {
      const response = await fetch('/api/templates/select', { // Auth handled by cookie
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.templates && data.templates.length > 0) {
            setFetchedTemplates(data.templates);
            generateCaptionsForAllTemplates(data.templates);
        } else {
            // Changed error message to be more specific
            setError('No meme templates found matching your criteria for this persona. Try a different prompt or check persona feedback.');
            setFetchedTemplates([]); 
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        setError(errorData.error || `Failed to fetch templates (${response.status})`);
      }
    } catch (err: any) {
      console.error('Error fetching templates:', err);
      setError(err.message || 'Network error. Please try again.');
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleSelectCaption = (template: MemeTemplate, caption: string) => {
    setSelectedFinalTemplate(template);
    setSelectedFinalCaption(caption);
    setOptionsForGenerator(memeOptions);
  };

  // Convert MemeOption[] to SelectedMeme format for MemeGenerator
  const convertToSelectedMemeFormat = (options: MemeOption[] | null): SelectedMeme | undefined => {
    if (!options) return undefined;
    return { templates: options.map(option => ({ template: option.template, captions: option.modelCaptions.flatMap(model => model.captions || []) })) };
  };

  const handleStartOver = () => {
     setMemeOptions(null);
     setFetchedTemplates(null);
     setError(null);
     setSelectedPersonaId('');
     setSelectedRuleSetId(''); // Reset rule set selection
     setUserPrompt('');
     setIsGreenscreenMode(false); // Reset greenscreen mode
     setSelectedFinalTemplate(null);
     setSelectedFinalCaption(null);
     // Clear localStorage
     localStorage.removeItem(LOCALSTORAGE_PERSONA_ID_KEY);
     localStorage.removeItem(LOCALSTORAGE_RULE_SET_ID_KEY);
  };

  // --- Rendering Logic --- 

  // Render MemeGenerator when template and caption are selected
  if (selectedFinalTemplate && selectedFinalCaption) {
    // Get the selected persona name again for passing to the generator
    const selectedPersona = personas?.find(p => p.id === selectedPersonaId);
    const personaNameToPass = selectedPersona ? selectedPersona.name : null;

    return (
      <MemeGenerator
        initialTemplate={selectedFinalTemplate}
        initialCaption={selectedFinalCaption}
        initialOptions={convertToSelectedMemeFormat(memeOptions)}
        isGreenscreenMode={isGreenscreenMode} 
        onToggleMode={() => setIsGreenscreenMode(!isGreenscreenMode)} 
        personaId={selectedPersonaId} // Keep passing ID for feedback etc.
        personaName={personaNameToPass} // Pass the name for the filename
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
      {/* Persona Manager Modal */} 
      <PersonaManager isOpen={isPersonaModalOpen} onClose={() => setIsPersonaModalOpen(false)} />
      {/* Caption Rule Manager Modal */}
      <CaptionRuleManager isOpen={isRuleModalOpen} onClose={() => setIsRuleModalOpen(false)} />


      {/* Global Error Display */} 
      {error && !isLoadingTemplates && !isLoadingCaptions && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded" role="alert">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Initial Form - Show if no results yet and not loading */} 
      {!memeOptions && !isLoadingTemplates && !isLoadingCaptions && (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl mx-auto mb-8">
          {/* Persona Selection */} 
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Persona *
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedPersonaId}
                onChange={(e) => setSelectedPersonaId(e.target.value)}
                disabled={isLoadingPersonas}
                className="flex-grow p-3 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                required
              >
                <option value="" disabled>{isLoadingPersonas ? 'Loading...' : '-- Select a Persona --'}</option>
                {personas?.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.name}
                  </option>
                ))}
              </select>
              <button 
                type="button"
                onClick={() => setIsPersonaModalOpen(true)}
                className="flex-shrink-0 py-2 px-3 bg-gray-600 hover:bg-gray-500 text-white rounded-md text-sm"
                title="Manage Personas"
              >
                Manage
              </button>
            </div>
            {personasError && <p className="text-xs text-red-400 mt-1">Error loading personas.</p>}
          </div>

          {/* Caption Rule Set Selection */} 
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Caption Rules Style
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedRuleSetId}
                onChange={(e) => setSelectedRuleSetId(e.target.value)}
                disabled={isLoadingRuleSets}
                className="flex-grow p-3 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Default Rules</option>
                {captionRuleSets?.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {rule.name}
                  </option>
                ))}
              </select>
              <button 
                type="button"
                onClick={() => setIsRuleModalOpen(true)}
                className="flex-shrink-0 py-2 px-3 bg-gray-600 hover:bg-gray-500 text-white rounded-md text-sm"
                title="Manage Caption Rules"
              >
                Manage
              </button>
            </div>
            {ruleSetsError && <p className="text-xs text-red-400 mt-1">Error loading rule sets.</p>}
          </div>

          {/* Meme Prompt */} 
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Describe your meme idea (Optional)
            </label>
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              className="w-full p-3 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="If you have an idea, describe it here... Otherwise, we'll pick random templates based on the persona."
            />
            <p className="text-xs text-gray-400 mt-1">Leave blank for random templates.</p>
          </div>

          {/* Greenscreen Mode Toggle */}
          <div className="flex items-center justify-start pt-2">
            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isGreenscreenMode}
                onChange={() => setIsGreenscreenMode(!isGreenscreenMode)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
              <span>Greenscreen Mode</span>
            </label>
          </div>

          {/* Submit Button */} 
          <button
            type="submit"
            disabled={isLoadingTemplates || isLoadingPersonas || isLoadingRuleSets || !selectedPersonaId}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoadingTemplates ? 'Fetching Templates...' : 'Generate Meme Options'}
          </button>
        </form>
      )}

      {/* Loading Indicator - Show only during caption generation */} 
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
          <div className="flex flex-wrap justify-center gap-6 pb-4">
            {memeOptions.map((option) => (
              <div key={option.template.id} className="w-full sm:w-[45%] md:w-[40%] lg:w-[30%] bg-gray-800 rounded-lg shadow-md p-4 border border-gray-700 flex flex-col" style={{ minWidth: '300px' }}> 
                <h3 className="font-medium text-lg mb-2 text-white">{option.template.name}</h3>
                <div className="mb-4 bg-gray-900 rounded flex-shrink-0">
                  {option.template.video_url ? (
                    <video src={option.template.video_url} className="w-full rounded" controls loop muted playsInline />
                  ) : (
                    <div className="w-full h-44 flex items-center justify-center bg-gray-700 rounded"><p className="text-gray-400">Video not available</p></div>
                  )}
                </div>
                <div className="space-y-4 flex-grow">
                  {option.modelCaptions.map((modelCaption) => (
                    <div key={modelCaption.modelId}>
                      <h4 className="font-medium text-blue-400 mb-2 flex items-center">
                        {getModelDisplayName(modelCaption.modelId)} Captions
                        {typeof modelCaption.latency === 'number' && (
                          <span className="ml-2 text-xs text-gray-500">({(modelCaption.latency / 1000).toFixed(1)}s)</span>
                        )}
                      </h4>
                      {modelCaption.error && (
                        <div className="bg-red-900 border border-red-700 p-2 rounded text-sm text-red-300 mb-2">Error: {modelCaption.error}</div>
                      )}
                      {modelCaption.captions.length === 0 && !modelCaption.error && (
                         <div className="p-2 text-sm text-gray-400 animate-pulse mb-2">Generating...</div>
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
                              <span className="flex-shrink-0 w-5 h-5 mt-0.5 flex items-center justify-center rounded-full bg-blue-900 text-blue-300 text-xs font-semibold">{index + 1}</span>
                              <span className="flex-grow">{caption}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* <<< Feedback Buttons for Options Card >>> */} 
                {selectedPersonaId && (
                  <div className="mb-3 pt-2 border-t border-gray-700 space-x-2 flex justify-center">
                    <button
                      onClick={() => handleFeedbackFromOptions(option.template.id, 'used')}
                      disabled={optionFeedbackLoading[option.template.id]}
                      className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      title="Mark this template as used/good for the selected persona"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Used
                    </button>
                    <button
                      onClick={() => handleFeedbackFromOptions(option.template.id, 'dont_use')}
                      disabled={optionFeedbackLoading[option.template.id]}
                      className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      title="Mark this template as bad/don't use for the selected persona"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      Don't Use
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button 
            onClick={handleStartOver} 
            className="mt-6 py-2 px-4 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors block mx-auto"
          >
           &larr; Start Over
          </button>
        </div>
      )}
    </div>
  );
} 