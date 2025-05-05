'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr'; // Import useSWR
import { MemeTemplate } from '@/lib/supabase/types'; // Assuming this type exists
import MemeGenerator from '@/app/components/MemeGenerator'; // Assuming this component exists
import { getCaptionGenerationTestPrompt } from "@/lib/utils/prompts";
import toast from 'react-hot-toast';
import PersonaManager from './PersonaManager'; // Import PersonaManager
import CaptionRuleManager from './CaptionRuleManager'; // Import CaptionRuleManager
import EditTemplateDetailsModal from './EditTemplateDetailsModal'; // Import the new modal
import SpinningOrb from './SpinningOrb'; // <-- Import SpinningOrb
import BackgroundSVG from './BackgroundSVG'; // <-- Import BackgroundSVG

// --- localStorage Keys ---
const LOCALSTORAGE_PERSONA_ID_KEY = 'memeSelectorV2_selectedPersonaId';
const LOCALSTORAGE_RULE_SET_ID_KEY = 'memeSelectorV2_selectedRuleSetId';
const LOCALSTORAGE_RULE_SET_ID_KEY_2 = 'memeSelectorV2_selectedRuleSetId2'; // New key for second rule set

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

// --- Updated Data Structures for Rule Set Grouping ---

// Represents a single generation attempt for a model using a specific rule set
interface ModelGenerationAttempt {
  ruleSetId: string; // '' for default
  ruleSetName: string; // 'Default Rules' or custom name
  captions: string[];
  error?: string | null;
  latency?: number; // Optional
}

// Holds all generation attempts for a single model
interface ModelCaptionData {
  modelId: string;
  generationAttempts: ModelGenerationAttempt[];
}

// Top-level structure holding template and all model results
export interface MemeOption {
  template: MemeTemplate;
  modelCaptions: ModelCaptionData[]; // Updated
}

// Interface for caption generation result (internal)
interface CaptionGenerationResult {
  templateId: string | number;
  modelId: string;
  ruleSetId: string; // Added
  ruleSetName: string; // Added
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
  const [selectedRuleSetId2, setSelectedRuleSetId2] = useState<string>(''); // Store selected second rule set ID ('' for none)
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

  // <<< State for feedback statuses per template >>>
  const [templateFeedbackStatuses, setTemplateFeedbackStatuses] = useState<Record<string, 'used' | 'dont_use' | null>>({});

  // --- State for Edit Template Details Modal ---
  const [isEditDetailsModalOpen, setIsEditDetailsModalOpen] = useState(false);
  const [templateToEdit, setTemplateToEdit] = useState<MemeTemplate | null>(null);
  // --- End State for Edit Template Details Modal ---

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
    const savedRuleSetId2 = localStorage.getItem(LOCALSTORAGE_RULE_SET_ID_KEY_2); // Load second rule set ID
    if (savedPersonaId) {
      setSelectedPersonaId(savedPersonaId);
    }
    if (savedRuleSetId) {
      setSelectedRuleSetId(savedRuleSetId);
    }
    if (savedRuleSetId2) { // Set second rule set state
      setSelectedRuleSetId2(savedRuleSetId2);
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

  // Effect to save selected second rule set ID to localStorage
  useEffect(() => {
    if (selectedRuleSetId2) {
      localStorage.setItem(LOCALSTORAGE_RULE_SET_ID_KEY_2, selectedRuleSetId2);
    } else {
      // If empty string (None), remove from storage
      localStorage.removeItem(LOCALSTORAGE_RULE_SET_ID_KEY_2);
    }
  }, [selectedRuleSetId2]);

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
    // Primary Rule Set
    const selectedRuleSet = captionRuleSets?.find(rule => rule.id === selectedRuleSetId);
    const primaryRulesText = selectedRuleSet?.rules_text; // Will be undefined if default ('') is selected

    // Optional Secondary Rule Set
    const selectedRuleSet2 = captionRuleSets?.find(rule => rule.id === selectedRuleSetId2);
    const secondaryRulesText = selectedRuleSet2?.rules_text; // Will be undefined if none ('') is selected
    
    // --- Get System Prompts --- 
    // Note: We now generate the prompt inside the loop if needed, as it might differ based on rules
    
    // --- Get Primary System Prompt (used if no secondary or for the first call) --- 
    const primarySystemPrompt = getCaptionGenerationTestPrompt(audienceName, audienceDescription, primaryRulesText);
    const primaryRuleSetName = selectedRuleSet ? selectedRuleSet.name : 'Default Rules';
    const primaryRuleSetId = selectedRuleSetId; // Includes '' for default
    // -----------------------------------------------------

    // --- Get Secondary System Prompt (if applicable) --- 
    let secondarySystemPrompt: string | null = null;
    let secondaryRuleSetName: string | null = null;
    const secondaryRuleSetId = selectedRuleSetId2; // Includes '' for none
    if (secondaryRulesText) {
        secondarySystemPrompt = getCaptionGenerationTestPrompt(audienceName, audienceDescription, secondaryRulesText);
        secondaryRuleSetName = selectedRuleSet2 ? selectedRuleSet2.name : 'Unknown Rule Set'; // Fallback name
    }

    // <<< Add Detailed Logging Here >>>
    console.log(`--- Generating Captions ---`);
    console.log(`Template: ${templates[0].name} (ID: ${templates[0].id})`); // Log the first template name for context
    console.log(`Audience Name: ${audienceName}`);
    console.log(`Audience Description: ${audienceDescription || '(None provided)'}`);
    console.log(`Primary Rules: ${selectedRuleSet ? selectedRuleSet.name : 'Default Rules'}`);
    if (secondaryRulesText) {
      console.log(`Secondary Rules: ${selectedRuleSet2 ? selectedRuleSet2.name : '(Invalid State - Secondary rules text exists but rule set not found?)'}`);
    } else {
      console.log(`Secondary Rules: None Selected`);
    }
    console.log(`Primary System Prompt (Start): ${primarySystemPrompt.substring(0, 200)}...`); 
    // console.log("Full Primary System Prompt:", primarySystemPrompt); // Uncomment if full prompt needed
    if (secondaryRulesText) {
      console.log(`Secondary System Prompt (Start): ${secondarySystemPrompt!.substring(0, 200)}...`);
      // console.log("Full Secondary System Prompt:", secondarySystemPrompt); // Uncomment if full prompt needed
    }


    const models = [
      'anthropic-3.5',
      'anthropic-3.7',
      // 'google-gemini-2.5-pro', // Commented out as requested
      // 'grok-3-latest' // Commented out as requested
    ];
    
    const initialOptions: MemeOption[] = templates.map(template => ({
      template,
      // Initialize with the new structure
      modelCaptions: models.map(modelId => ({ modelId, generationAttempts: [] })) 
    }));
    setMemeOptions(initialOptions);
    
    const captionPromises = [];
    
    for (const template of templates) {
      for (const modelId of models) {
        // Base user message remains the same
        const userMessage = `User Prompt: "${userPrompt || "Create captions for this meme template"}"\n\nTemplate Name: ${template.name}\nTemplate Instructions: ${template.instructions || 'None'}`;
        
        // --- Call 1: Using Primary Rules ---
        const apiRequestBody1 = {
          model: modelId,
          messages: [
            { role: 'system', content: primarySystemPrompt }, // Using the primary prompt
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7
        };
        
        const promise1 = fetch('/api/ai/chat', { // Auth handled via cookie
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiRequestBody1)
        })
        .then(async response => { /* ... (response handling logic remains the same) ... */ 
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
                const match = jsonString.match(/```(?:json)?\\s*([\\s\\S]*?)\\s*```/);
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
              captions = captions.slice(0, 5); // Still take top 5 per call
            } catch (e: any) {
              console.error("Error parsing captions:", e);
              return { 
                templateId: template.id, 
                modelId, 
                ruleSetId: primaryRuleSetId, 
                ruleSetName: primaryRuleSetName,
                captions: [], 
                error: e.message || "Failed to parse AI response", 
                latency 
              } as CaptionGenerationResult;
            }
            // Add rule set info to the result
            return { 
                templateId: template.id, 
                modelId, 
                ruleSetId: primaryRuleSetId, 
                ruleSetName: primaryRuleSetName,
                captions, 
                error: undefined, 
                latency 
            } as CaptionGenerationResult;
        })
        .catch(error => {
          console.error(`Error fetching captions (Primary Rules) for ${template.name} from ${modelId}:`, error);
          // Add rule set info to the error result
          return { 
              templateId: template.id, 
              modelId, 
              ruleSetId: primaryRuleSetId, 
              ruleSetName: primaryRuleSetName,
              captions: [], 
              error: error.message || 'Generation failed (Primary)' 
          } as CaptionGenerationResult;
        });
        captionPromises.push(promise1);

        // --- Call 2: Using Secondary Rules (if selected) ---
        if (secondaryRulesText && secondarySystemPrompt && secondaryRuleSetName) {
            // Explicit null check directly before usage often helps the type checker
            if (secondarySystemPrompt === null || secondaryRuleSetName === null) {
                console.error("Type checking failed: Secondary prompt or name is null despite checks.");
                // Optionally skip this iteration or handle error
                continue; // Skip making the second call for this model/template combo if types are wrong
            }
            // Now TypeScript should be confident they are strings
            const currentSecondarySystemPrompt = secondarySystemPrompt;
            const currentSecondaryRuleSetName = secondaryRuleSetName;
            const currentSecondaryRuleSetId = secondaryRuleSetId;

            const apiRequestBody2 = {
                model: modelId,
                messages: [
                  { role: 'system', content: currentSecondarySystemPrompt }, // Use the non-null constant
                  { role: 'user', content: userMessage }
                ],
                temperature: 0.7
            };

            const promise2 = fetch('/api/ai/chat', { // Auth handled via cookie
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiRequestBody2)
            })
            .then(async response => { /* ... (response handling logic is identical to promise1) ... */ 
                const startTime = Date.now();
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
                    const match = jsonString.match(/```(?:json)?\\s*([\\s\\S]*?)\\s*```/);
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
                  captions = captions.slice(0, 5); // Still take top 5 per call
                } catch (e: any) {
                  console.error("Error parsing captions:", e);
                  return { 
                    templateId: template.id, 
                    modelId, 
                    ruleSetId: currentSecondaryRuleSetId, // Use constant
                    ruleSetName: currentSecondaryRuleSetName, // Use constant
                    captions: [], 
                    error: e.message || "Failed to parse AI response", 
                    latency 
                  } as CaptionGenerationResult;
                }
                // Add rule set info to the result
                return { 
                    templateId: template.id, 
                    modelId, 
                    ruleSetId: currentSecondaryRuleSetId, // Use constant
                    ruleSetName: currentSecondaryRuleSetName, // Use constant
                    captions, 
                    error: undefined, 
                    latency 
                } as CaptionGenerationResult;
            })
            .catch(error => {
              console.error(`Error fetching captions (Secondary Rules) for ${template.name} from ${modelId}:`, error);
              // Add rule set info to the error result
              return { 
                  templateId: template.id, 
                  modelId, 
                  ruleSetId: currentSecondaryRuleSetId, // Use constant
                  ruleSetName: currentSecondaryRuleSetName, // Use constant
                  captions: [], 
                  error: error.message || 'Generation failed (Secondary)' 
              } as CaptionGenerationResult;
            });
            captionPromises.push(promise2);
        }
      }
    }
    
    const results = await Promise.allSettled(captionPromises);
    
    const finalOptions = [...initialOptions]; 
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
         const { templateId, modelId, captions, error, latency, ruleSetId, ruleSetName } = result.value;
         const templateIndex = finalOptions.findIndex(opt => opt.template.id === templateId);
         if (templateIndex >= 0) {
           const modelIndex = finalOptions[templateIndex].modelCaptions.findIndex(m => m.modelId === modelId);
           if (modelIndex >= 0) {
             // --- Create and push a new generation attempt --- 
             const newAttempt: ModelGenerationAttempt = {
                ruleSetId,
                ruleSetName,
                captions: error ? [] : captions,
                error: error || undefined,
                latency
             };
             finalOptions[templateIndex].modelCaptions[modelIndex].generationAttempts.push(newAttempt);
             
             // Optional: Could sort attempts by ruleSetId or name if needed for consistent display order
             // finalOptions[templateIndex].modelCaptions[modelIndex].generationAttempts.sort(...);
           }
         }
      } else if (result.status === 'rejected') {
          // Handle rejected promises if necessary (e.g., log which specific call failed)
         console.error("A caption generation promise was rejected:", result.reason);
         // Potentially find the corresponding template/model in initialOptions and mark with a generic network error
         // Finding the specific template/model that failed from just the reason might be difficult here.
         // We could try to parse the error or pass more context in the promise chain if needed.
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
      // <<< Update the state for this specific templateId >>>
      setTemplateFeedbackStatuses(prev => ({
        ...prev,
        [templateId]: status
      }));

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
      count: 5,
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
  // *** This needs adjustment if MemeGenerator expects a flat list ***
  const convertToSelectedMemeFormat = (options: MemeOption[] | null): SelectedMeme | undefined => {
    if (!options) return undefined;
    // Flatten captions from all generation attempts for now
    // TODO: Revisit if MemeGenerator needs more structure
    return { 
        templates: options.map(option => ({ 
            template: option.template, 
            captions: option.modelCaptions.flatMap(mc => mc.generationAttempts.flatMap(att => att.captions))
        })) 
    };
  };

  const handleStartOver = () => {
     setMemeOptions(null);
     setFetchedTemplates(null);
     setError(null);
     setSelectedPersonaId('');
     setSelectedRuleSetId(''); // Reset rule set selection
     setUserPrompt('');
     setSelectedRuleSetId2(''); // Reset second rule set selection
     setIsGreenscreenMode(false); // Reset greenscreen mode
     setSelectedFinalTemplate(null);
     setSelectedFinalCaption(null);
     // Clear localStorage
     localStorage.removeItem(LOCALSTORAGE_PERSONA_ID_KEY);
     localStorage.removeItem(LOCALSTORAGE_RULE_SET_ID_KEY);
     localStorage.removeItem(LOCALSTORAGE_RULE_SET_ID_KEY_2); // Clear second rule set storage
  };

  // --- New Handlers for Edit Details Modal ---
  const handleEditDetailsClick = (template: MemeTemplate) => {
    setTemplateToEdit(template);
    setIsEditDetailsModalOpen(true);
  };

  const handleSaveTemplateDetails = async (templateId: string, newName: string, newInstructions: string): Promise<MemeTemplate | null> => {
    const payload: Partial<MemeTemplate> = {};
    const originalTemplate = memeOptions?.find(opt => opt.template.id === templateId)?.template;

    // Only include fields that have actually changed
    if (originalTemplate && newName !== originalTemplate.name) {
      payload.name = newName;
    }
    if (originalTemplate && newInstructions !== (originalTemplate.instructions || '')) {
      payload.instructions = newInstructions;
    }

    // If no changes were detected by the modal logic already, this shouldn't be called,
    // but double-check here just in case.
    if (Object.keys(payload).length === 0) {
      toast('No changes detected to save.');
      return originalTemplate || null; // Return original if nothing changed
    }

    const toastId = toast.loading('Saving template details...');

    try {
      console.log('Updating template details:', templateId, payload);
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to save details (Status: ${response.status})`);
      }

      const savedTemplate: MemeTemplate = await response.json(); // Get updated template

      // Update local state IN PLACE
      setMemeOptions(prevOptions =>
        prevOptions?.map(opt =>
          opt.template.id === templateId
            ? { ...opt, template: savedTemplate } // Update the template within the option
            : opt
        ) ?? null // Handle null case for prevOptions
      );

      toast.success('Template details updated!', { id: toastId });
      return savedTemplate; // Return the updated template on success

    } catch (err: any) {
      console.error('Save template details failed:', err);
      toast.error(`Save failed: ${err.message}`, { id: toastId });
      return null; // Return null on failure
    }
  };
  // --- End New Handlers ---

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
    <div className="w-full mx-auto p-4 max-w-screen-2xl">
      {/* Persona Manager Modal */} 
      <PersonaManager isOpen={isPersonaModalOpen} onClose={() => setIsPersonaModalOpen(false)} />
      {/* Caption Rule Manager Modal */}
      <CaptionRuleManager isOpen={isRuleModalOpen} onClose={() => setIsRuleModalOpen(false)} />
      {/* --- Edit Template Details Modal --- */}
      <EditTemplateDetailsModal
        isOpen={isEditDetailsModalOpen}
        onClose={() => {
          setIsEditDetailsModalOpen(false);
          // Optionally clear templateToEdit here if needed, though useEffect handles it
          // setTemplateToEdit(null); 
        }}
        template={templateToEdit}
        onSave={handleSaveTemplateDetails}
      />
      {/* --- End Edit Template Details Modal --- */}


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
              Caption Rules Style (Primary)
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

          {/* Optional Second Caption Rule Set Selection */} 
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Optional Second Caption Rules Style
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedRuleSetId2}
                onChange={(e) => setSelectedRuleSetId2(e.target.value)}
                disabled={isLoadingRuleSets}
                className="flex-grow p-3 border border-gray-700 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">None</option> {/* Add None option */}
                {captionRuleSets?.map((rule) => (
                  // Optionally disable selection if it's the same as the primary
                  // disabled={rule.id === selectedRuleSetId && selectedRuleSetId !== ''} 
                  <option key={rule.id} value={rule.id}> 
                    {rule.name}
                  </option>
                ))}
              </select>
              {/* Reuse the same manage button, it controls the same modal */}
              <button 
                type="button"
                onClick={() => setIsRuleModalOpen(true)}
                className="flex-shrink-0 py-2 px-3 bg-gray-600 hover:bg-gray-500 text-white rounded-md text-sm"
                title="Manage Caption Rules"
              >
                Manage
              </button>
            </div>
            {/* Display the same error message if rule sets fail to load */}
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

      {/* Loading Indicator - Show only during caption generation - UPDATED */}
      {isLoadingCaptions && (
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

      {/* Results Columns - Show when options are loaded and not generating captions */} 
      {memeOptions && !isLoadingCaptions && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-100 mb-4 text-center">Generated Options</h2>
          <div className="flex flex-wrap justify-center gap-6 pb-4">
            {memeOptions.map((option) => (
              <div key={option.template.id} className="w-full sm:w-[45%] md:w-[40%] lg:w-[30%] xl:w-[18%] bg-gray-800 rounded-lg shadow-md p-4 border border-gray-700 flex flex-col" style={{ minWidth: '280px' }}> 
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
                        {/* Maybe display average/total latency here later? */}
                        {/* {typeof modelCaption.latency === 'number' && (
                          <span className="ml-2 text-xs text-gray-500">({(modelCaption.latency / 1000).toFixed(1)}s)</span>
                        )} */}
                      </h4>
                      
                      {/* Loop through Generation Attempts (Rule Sets) */} 
                      {modelCaption.generationAttempts.length === 0 && (
                          <div className="p-2 text-sm text-gray-400 animate-pulse mb-2">Generating...</div>
                      )}

                      {modelCaption.generationAttempts.map((attempt, attemptIndex) => (
                        <div key={`${modelCaption.modelId}-${attempt.ruleSetId || 'default'}-${attemptIndex}`} className="mb-4">
                          <h5 className="font-normal text-sm text-gray-300 mb-2 flex items-center">
                             <span className="mr-2 font-medium">{attempt.ruleSetName}</span>
                            {/* {typeof attempt.latency === 'number' && (
                                <span className="text-xs text-gray-500">({(attempt.latency / 1000).toFixed(1)}s)</span>
                            )} */}
                          </h5>
                          {attempt.error && (
                            <div className="bg-red-900 border border-red-700 p-2 rounded text-sm text-red-300 mb-2">Error: {attempt.error}</div>
                          )}
                          {attempt.captions.length === 0 && !attempt.error && (
                             <div className="p-2 text-sm text-gray-400 mb-2">No captions generated.</div> // Changed from Generating
                          )}
                          {attempt.captions.length > 0 && (
                            <div className="space-y-2">
                              {attempt.captions.map((caption, index) => (
                                <button
                                  key={index} // Index is now relative to this attempt's captions (0-4)
                                  onClick={() => handleSelectCaption(option.template, caption)}
                                  className="w-full text-left p-3 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors duration-150 hover:border-blue-500 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-gray-800 flex items-start gap-2"
                                  title="Select this caption"
                                >
                                  {/* Numbering resets for each rule set (1-5) */}
                                  <span className="flex-shrink-0 w-5 h-5 mt-0.5 flex items-center justify-center rounded-full bg-blue-900 text-blue-300 text-xs font-semibold">{index + 1}</span>
                                  <span className="flex-grow">{caption}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {/* <<< Feedback Buttons for Options Card >>> */} 
                {selectedPersonaId && (
                  <div className="mt-4 pt-4 border-t border-gray-700 space-x-2 flex justify-center">
                    <button
                      onClick={() => handleFeedbackFromOptions(option.template.id, 'used')}
                      disabled={optionFeedbackLoading[option.template.id]}
                      className={`px-2 py-1 text-xs rounded-md flex items-center gap-1 transition-all duration-150 ease-in-out 
                        ${templateFeedbackStatuses[option.template.id] === 'used' 
                          ? 'bg-green-600 hover:bg-green-700 text-white ring-2 ring-offset-2 ring-offset-gray-800 ring-green-500' 
                          : templateFeedbackStatuses[option.template.id] === 'dont_use' 
                            ? 'bg-green-800 hover:bg-green-700 text-green-300 opacity-60 hover:opacity-100' 
                            : 'bg-green-600 hover:bg-green-700 text-white' // Default
                        } 
                        disabled:opacity-50 disabled:cursor-not-allowed`}
                      title="Mark this template as used/good for the selected persona"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Used
                    </button>
                    <button
                      onClick={() => handleFeedbackFromOptions(option.template.id, 'dont_use')}
                      disabled={optionFeedbackLoading[option.template.id]}
                      className={`px-2 py-1 text-xs rounded-md flex items-center gap-1 transition-all duration-150 ease-in-out 
                        ${templateFeedbackStatuses[option.template.id] === 'dont_use' 
                          ? 'bg-red-600 hover:bg-red-700 text-white ring-2 ring-offset-2 ring-offset-gray-800 ring-red-500' 
                          : templateFeedbackStatuses[option.template.id] === 'used' 
                            ? 'bg-red-800 hover:bg-red-700 text-red-300 opacity-60 hover:opacity-100' 
                            : 'bg-red-600 hover:bg-red-700 text-white' // Default
                        } 
                        disabled:opacity-50 disabled:cursor-not-allowed`}
                      title="Mark this template as bad/don't use for the selected persona"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      Don't Use
                    </button>
                  </div>
                )}

                {/* --- Instructions Display - MOVED HERE --- */}
                <div
                  className="mt-4 pt-4 border-t border-gray-700 p-3 bg-gray-700/60 rounded-md cursor-pointer hover:bg-gray-700/90 transition-colors" // Added mt-4, pt-4, border-t, removed mb-4, added full bg
                  onClick={() => handleEditDetailsClick(option.template)}
                  title="Click to edit name/instructions"
                >
                    <p className="text-xs font-medium text-gray-400 mb-1">Instructions:</p>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-3">
                      {option.template.instructions || <span className="italic text-gray-500">No instructions provided. Click to add.</span>}
                    </p>
                </div>
                {/* --- End Instructions Display --- */}

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