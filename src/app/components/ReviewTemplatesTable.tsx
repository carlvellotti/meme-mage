'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast'; // Assuming react-hot-toast is installed and configured
import VideoPreviewCropModal from './VideoPreviewCropModal'; // Import the new modal
import ReactMarkdown from 'react-markdown'; // <-- Added import
import remarkGfm from 'remark-gfm'; // <-- Import remark-gfm

// Assuming a type definition like this exists in src/lib/supabase/types.ts
// Need to import the actual type when available
interface MemeTemplate {
  id: string;
  name: string;
  instructions: string; // Potentially null?
  video_url: string;
  poster_url?: string | null;
  original_source_url?: string | null;
  reviewed?: boolean | null;
  uploader_name?: string | null; // Added uploader name field
  category?: string | null; // <-- Added category
  // Add other relevant fields as needed from the actual type
}

// Helper function to preprocess markdown for better list rendering
function preprocessMarkdownForLists(markdownText: string): string {
  if (!markdownText) return '';

  // Split into lines
  const lines = markdownText.split('\n');
  const processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    const trimmedLine = currentLine.trim();
    const prevLine = i > 0 ? lines[i - 1] : null;
    const trimmedPrevLine = prevLine?.trim();

    // Regex to check for common list markers (unordered *, -, + or ordered 1.)
    const isListMarker = /^(\*|\-|\+|\d+\.)\s+/.test(trimmedLine);
    // Check if the previous line was also a list marker (of the same type potentially, simplified for now)
    const prevIsListMarker = trimmedPrevLine ? /^(\*|\-|\+|\d+\.)\s+/.test(trimmedPrevLine) : false;
    // Check if previous line was blank
    const prevIsBlank = trimmedPrevLine === '';

    // Add a blank line *before* a list item if the previous line exists,
    // wasn't blank, and wasn't also a list item.
    if (isListMarker && prevLine !== null && !prevIsBlank && !prevIsListMarker) {
      processedLines.push(''); // Insert blank line
    }
    
    // Add the current line
    processedLines.push(currentLine);

    // --- Add blank line *after* a list block --- 
    // Check if the *next* line exists and is NOT a list item or blank
    // This helps separate list blocks from subsequent paragraphs
    const nextLine = i + 1 < lines.length ? lines[i + 1] : null;
    const trimmedNextLine = nextLine?.trim();
    const nextIsListMarker = trimmedNextLine ? /^(\*|\-|\+|\d+\.)\s+/.test(trimmedNextLine) : false;
    const nextIsBlank = trimmedNextLine === '';

    if (isListMarker && nextLine !== null && !nextIsListMarker && !nextIsBlank) {
        processedLines.push(''); // Add blank line after
    }
  }

  return processedLines.join('\n');
}

// New helper function to wrap long lines in markdown
function wrapLongLines(markdownText: string, maxLineLength: number = 80): string {
  if (!markdownText) return '';
  
  // Split into lines
  const lines = markdownText.split('\n');
  const wrappedLines: string[] = [];
  
  // Process each line
  for (const line of lines) {
    if (line.length <= maxLineLength) {
      wrappedLines.push(line); // Keep short lines as is
      continue;
    }
    
    // For longer lines, we need to analyze and split them
    let currentLine = line;
    let indent = '';
    
    // Preserve indentation at the beginning of the line
    const indentMatch = currentLine.match(/^(\s+)/);
    if (indentMatch) {
      indent = indentMatch[1];
      currentLine = currentLine.substring(indent.length);
    }
    
    // Check if line starts with a list marker
    const listMarkerMatch = currentLine.match(/^(\*|\-|\+|\d+\.)\s+/);
    let listMarker = '';
    if (listMarkerMatch) {
      listMarker = listMarkerMatch[0];
      currentLine = currentLine.substring(listMarker.length);
    }
    
    // Now handle the actual text, preserving indentation and list markers for wrapped lines
    let currentPosition = 0;
    let firstSegment = true;
    
    while (currentPosition < currentLine.length) {
      const remainingText = currentLine.substring(currentPosition);
      let segmentLength = maxLineLength;
      
      if (firstSegment) {
        // First segment gets the list marker and full indentation
        segmentLength = maxLineLength - (indent.length + listMarker.length);
        if (segmentLength < 20) segmentLength = 20; // Minimum to avoid tiny segments
        
        wrappedLines.push(indent + listMarker + remainingText.substring(0, segmentLength).trim());
        firstSegment = false;
      } else {
        // Subsequent segments get indentation plus additional spaces for alignment
        const continuationIndent = indent + ' '.repeat(listMarker.length);
        segmentLength = maxLineLength - continuationIndent.length;
        if (segmentLength < 20) segmentLength = 20;
        
        wrappedLines.push(continuationIndent + remainingText.substring(0, segmentLength).trim());
      }
      
      currentPosition += segmentLength;
    }
  }
  
  return wrappedLines.join('\n');
}

interface UnreviewedTemplatesTableProps {
  className?: string;
  refreshTrigger?: number; // Optional prop to trigger refresh when value changes
}

// --- Edit Template Modal Component ---
interface EditTemplateModalProps { 
  isOpen: boolean;
  onClose: () => void;
  template: MemeTemplate | null;
  initialName: string;          
  initialInstructions: string;
  uploaderName?: string | null; 
  onSaveChanges: (templateId: string, newName: string, newInstructions: string) => Promise<MemeTemplate | null>;
  onSaveAndApprove: (templateId: string, newName: string, newInstructions: string) => Promise<void>;
  onReanalysisSubmitted: () => void; // <-- New prop
}

const EditTemplateModal: React.FC<EditTemplateModalProps> = ({ 
  isOpen,
  onClose,
  template,
  initialName,             
  initialInstructions,
  uploaderName,             
  onSaveChanges,
  onSaveAndApprove,
  onReanalysisSubmitted // <-- New prop
}) => {
  const [modalName, setModalName] = useState(initialName);              
  const [modalInstructions, setModalInstructions] = useState(initialInstructions);
  const [feedbackText, setFeedbackText] = useState(''); // <-- New state for feedback
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingReanalysis, setIsSubmittingReanalysis] = useState(false); // <-- New state for reanalysis submission
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);

  useEffect(() => {
    setModalName(initialName);
    setModalInstructions(initialInstructions);
    setFeedbackText(''); // Reset feedback text when template/props change
  }, [initialName, initialInstructions, template]); // Added template to dependency array to ensure reset


  if (!isOpen || !template) return null;

  const hasDirectChanges = modalName !== initialName || modalInstructions !== initialInstructions;

  const handleSaveChangesClick = async () => {
      setIsSaving(true);
      try {
          await onSaveChanges(template.id, modalName, modalInstructions);
          // Do not close modal here, allow user to make further changes or trigger re-analysis
      } catch (error) {
          console.error("Error saving changes:", error);
      } finally {
          setIsSaving(false);
      }
  };

   const handleSaveAndApproveClick = async () => {
      setIsSaving(true);
      try {
          await onSaveAndApprove(template.id, modalName, modalInstructions);
          onClose(); 
      } catch (error) {
          console.error("Error saving and approving:", error);
      } finally {
          setIsSaving(false);
      }
  };

  const handleSaveAndReanalyzeClick = async () => {
    if (!template) return;
    setIsSubmittingReanalysis(true);
    const payload: any = {
        triggerReanalysis: true,
        feedbackContext: feedbackText,
    };
    if (modalName !== initialName) {
        payload.name = modalName;
    }
    if (modalInstructions !== initialInstructions) {
        // Send the current state of instructions for potential save before AI overwrites
        payload.instructions = modalInstructions; 
    }

    try {
        const response = await fetch(`/api/templates/${template.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (response.status === 202) {
            toast.success('Re-analysis started. Template will update in the list soon.');
            onReanalysisSubmitted(); // Notify parent to refresh
            onClose(); // Close the modal
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to start re-analysis (Status: ${response.status})`);
        }
    } catch (err: any) {
        console.error('Re-analysis submission failed:', err);
        toast.error(`Re-analysis failed: ${err.message}`);
    } finally {
        setIsSubmittingReanalysis(false);
    }
  };


  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
          onClose();
      }
  };


  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity duration-300 px-4 py-8"
        onClick={handleOverlayClick} 
    >
      <div className="bg-gray-800 p-6 rounded-lg w-full max-w-4xl mx-auto relative shadow-xl border border-gray-700 flex flex-col max-h-[95vh] overflow-hidden">
        <h3 className="text-lg font-semibold text-white mb-1 flex-shrink-0">Edit Template: {initialName}</h3>
        {/* Display Uploader Name if available */} 
        {uploaderName && (
            <p className="text-xs text-gray-400 mb-4 flex-shrink-0">Uploader: {uploaderName}</p>
        )}
        
        {/* Name input field */}
        <div className="mb-4 flex-shrink-0">
            <label htmlFor="modal-template-name" className="block text-sm font-medium text-gray-300 mb-1">
                Template Name
            </label>
            <input
                id="modal-template-name"
                type="text"
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                required
            />
        </div>

        {/* Instructions Area - UPDATED */}
         <div className="mb-4 flex-grow flex flex-col">
            <label htmlFor="modal-template-instructions" className="block text-sm font-medium text-gray-300 mb-1">
                Instructions {isEditingInstructions ? '(Editing - Click outside to view)' : '(Click to edit)'}
            </label>
            {isEditingInstructions ? (
              <textarea
                  id="modal-template-instructions"
                  value={modalInstructions}
                  onChange={(e) => setModalInstructions(e.target.value)}
                  onBlur={() => setIsEditingInstructions(false)} // <-- Switch back on blur
                  className="w-full p-3 border border-blue-500 bg-gray-700 text-white rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm resize-y flex-grow" // Highlight border when editing
                  placeholder="Enter detailed instructions..."
                  style={{minHeight: '300px', maxHeight: '40vh'}} // Adjusted height
                  autoFocus // Focus when switching to edit mode
              />
            ) : (
              <div
                  onClick={() => setIsEditingInstructions(true)} // <-- Switch to edit on click
                  className="w-full p-3 pb-6 border border-gray-600 bg-gray-700/60 text-white rounded-md text-sm flex-grow cursor-pointer hover:border-gray-500 overflow-y-auto prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5"
                  style={{minHeight: '300px', maxHeight: '40vh'}} // Adjusted height
              >
                  {modalInstructions ? (
                      <ReactMarkdown 
                          remarkPlugins={[remarkGfm]} 
                          components={{
                              ol: ({node, ...props}) => <ol className="list-decimal list-outside pl-8 mb-2" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc list-outside pl-8 mb-2" {...props} />,
                              li: ({node, ...props}) => <li className="mb-1 pl-1" {...props} />
                          }}
                      >
                          {preprocessMarkdownForLists(modalInstructions)}
                      </ReactMarkdown>
                  ) : (
                      <span className="text-gray-500 italic">No instructions provided. Click to add.</span>
                  )}
              </div>
            )}
        </div>

        {/* NEW: Feedback for Re-analysis Textarea */}
        <div className="mb-4 flex-shrink-0">
            <label htmlFor="modal-feedback-text" className="block text-sm font-medium text-gray-300 mb-1">
                Feedback for Re-analysis (AI will prioritize this; optional)
            </label>
            <textarea
                id="modal-feedback-text"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm resize-y"
                placeholder="e.g., The main character is actually feeling sarcastic, not surprised. Focus on the cat in the background."
                rows={3}
                disabled={isSubmittingReanalysis || isSaving}
            />
        </div>

        {/* Modal Footer */}
        <div className="mt-auto flex justify-end space-x-3 flex-shrink-0 pt-4 border-t border-gray-700">
          <button
            onClick={onClose} 
            disabled={isSaving || isSubmittingReanalysis}
            className="px-4 py-2 text-sm font-medium rounded-md text-gray-300 bg-gray-600 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-400 disabled:opacity-50"
          >
            Cancel
          </button>
          {/* Save Changes Button */}
          <button
            onClick={handleSaveChangesClick}
            disabled={isSaving || isSubmittingReanalysis || !hasDirectChanges}
            className="px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-wait"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          {/* NEW: Save & Start Re-analysis Button */}
          <button
            onClick={handleSaveAndReanalyzeClick}
            disabled={isSaving || isSubmittingReanalysis || !feedbackText.trim()} // Disable if no feedback or already processing
            className="px-4 py-2 text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-wait"
          >
            {isSubmittingReanalysis ? 'Starting Re-analysis...' : 'Save & Start Re-analysis'}
          </button>
           {/* Save & Approve Button */}
          <button
            onClick={handleSaveAndApproveClick}
            disabled={isSaving || isSubmittingReanalysis} 
            className="px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 disabled:opacity-50 disabled:cursor-wait"
          >
            {isSaving ? 'Saving...' : 'Save & Approve'}
          </button>
        </div>
      </div>
    </div>
  );
};
// --- End Edit Template Modal Component ---

const REVIEW_LIMIT = 10; // Items per page for review table
const AVAILABLE_CATEGORIES = ['gym']; // <-- Added available categories

const UnreviewedTemplatesTable: React.FC<UnreviewedTemplatesTableProps> = ({ 
    className,
    refreshTrigger = 0 
}) => {
  const [unreviewedTemplates, setUnreviewedTemplates] = useState<MemeTemplate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  
  // State for Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentEditingTemplate, setCurrentEditingTemplate] = useState<MemeTemplate | null>(null);
  const [editModalInitialName, setEditModalInitialName] = useState('');
  const [editModalInitialInstructions, setEditModalInitialInstructions] = useState('');

  // State for Preview/Crop Modal
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [currentPreviewTemplate, setCurrentPreviewTemplate] = useState<MemeTemplate | null>(null);

  // State for pending category updates
  const [pendingCategoryUpdates, setPendingCategoryUpdates] = useState<Record<string, string | null>>({});

  const fetchUnreviewedTemplates = async (pageToFetch = 1, loadMore = false) => {
    console.log(`Fetching unreviewed templates: page=${pageToFetch}, loadMore=${loadMore}`);
    
    if (loadMore) {
        setIsLoadingMore(true);
    } else {
        setIsLoading(true);
        setUnreviewedTemplates([]); // Clear existing on refresh/initial
        setCurrentPage(1); // Reset page on refresh/initial
        setPendingCategoryUpdates({}); // Reset pending updates on refresh
    }
    setError(null);

    try {
      // Construct URL with pagination params
      const apiUrl = `/api/templates?reviewed=false&page=${pageToFetch}&limit=${REVIEW_LIMIT}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorData.message || JSON.stringify(errorData);
        } catch (parseError) {
          console.error("Failed to parse error response as JSON");
        }
        throw new Error(errorMsg);
      }

      // Expect the object { templates: [], totalCount: number }
      const data = await response.json();
      console.log('API Response Data for Unreviewed Templates:', data);

      // Validate the response structure
      if (data && Array.isArray(data.templates) && typeof data.totalCount === 'number') {
        const newTemplates = data.templates;
        const fetchedCount = newTemplates.length;
        const newTotalCount = data.totalCount;
        
        setTotalCount(newTotalCount); // Update total count

        // Append or set templates based on loadMore flag
        setUnreviewedTemplates(prev => loadMore ? [...prev, ...newTemplates] : newTemplates);
        
        // Determine if there are more pages
        const currentTotalLoaded = loadMore ? unreviewedTemplates.length + fetchedCount : fetchedCount;
        setHasMore(currentTotalLoaded < newTotalCount);

        // Update current page if loading more
        if (loadMore) {
          setCurrentPage(pageToFetch);
        }

      } else {
        console.error('API did not return the expected format:', data);
        setUnreviewedTemplates([]);
        setTotalCount(0);
        setHasMore(false);
        throw new Error('Received invalid data format from the server.');
      }

    } catch (err: any) {
      console.error("Failed to fetch unreviewed templates:", err);
      setError(err.message || 'Failed to load templates. Please try again later.');
      // Reset state on error
      setUnreviewedTemplates([]);
      setTotalCount(0);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Fetch on initial mount
  useEffect(() => {
    fetchUnreviewedTemplates(1, false); // Fetch page 1 initially
  }, []);

  // Fetch when refreshTrigger prop changes
  useEffect(() => {
    if (refreshTrigger > 0) { 
        console.log('Refresh trigger changed, re-fetching page 1...');
        fetchUnreviewedTemplates(1, false); // Fetch page 1 on trigger
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]); 

  const handleRefreshClick = () => {
    fetchUnreviewedTemplates(1, false); // Fetch page 1 on manual refresh
    toast.success('Refreshed review list');
  };

  // --- NEW: Handler for when reanalysis is submitted from modal ---
  const handleReanalysisSubmitted = () => {
    console.log('Re-analysis submitted, triggering refresh of review list.');
    fetchUnreviewedTemplates(1, false); // Re-fetch page 1
    // Or, you could use setRefreshTrigger(prev => prev + 1) if you prefer that pattern
  };

  // Handle Load More click
  const handleLoadMoreClick = () => {
      if (hasMore && !isLoadingMore) {
          fetchUnreviewedTemplates(currentPage + 1, true); // Fetch next page
      }
  };

  const handleEditClick = (template: MemeTemplate) => {
    setCurrentEditingTemplate(template);
    setEditModalInitialName(template.name);
    setEditModalInitialInstructions(template.instructions || '');
    setIsEditModalOpen(true);
  };

  // Just saves Name/Instructions changes and updates item IN the list
  const handleSaveChangesOnly = async (templateId: string, newName: string, newInstructions: string): Promise<MemeTemplate | null> => {
      console.log('Saving changes only for:', templateId, { name: newName, instructions: newInstructions });
      const originalTemplate = unreviewedTemplates.find(t => t.id === templateId);
      const payload: Partial<MemeTemplate> = {};
      let changesMade = false;

      if (newName !== originalTemplate?.name) {
          payload.name = newName;
          changesMade = true;
      }
      if (newInstructions !== (originalTemplate?.instructions || '')) {
          payload.instructions = newInstructions;
          changesMade = true;
      }

      if (!changesMade) {
          toast('No changes detected.');
          return Promise.resolve(originalTemplate || null); // Resolve with original if no changes
      }

      // Wrap in promise for consistency
      return new Promise(async (resolve, reject) => {
          try {
              console.log('Payload for save:', payload);
              const saveResponse = await fetch(`/api/templates/${templateId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
              });

              if (!saveResponse.ok) {
                  const errorData = await saveResponse.json();
                  throw new Error(errorData.error || `Failed to save changes (Status: ${saveResponse.status})`);
              }

              const savedTemplate: MemeTemplate = await saveResponse.json(); // Get updated template

              // Update local state IN PLACE
              setUnreviewedTemplates(prev =>
                  prev.map(t => t.id === templateId ? savedTemplate : t) // Update the item
              );

              toast.success('Template changes saved!');
              resolve(savedTemplate); // Resolve with the saved template
          } catch (err: any) {
              console.error('Save changes failed:', err);
              toast.error(`Save failed: ${err.message}`);
              reject(err);
          }
      });
  };

  // Just approves the template and removes from list
  const handleApproveOnly = async (templateId: string): Promise<void> => {
      const template = unreviewedTemplates.find(t => t.id === templateId);
      if (!template) return Promise.reject(new Error("Template not found locally"));

      // Determine the category to save: use pending update, or existing, or null
      const categoryToSave = pendingCategoryUpdates.hasOwnProperty(templateId)
        ? (pendingCategoryUpdates[templateId] === "" ? null : pendingCategoryUpdates[templateId])
        : (template.category === "" ? null : template.category);

      console.log(`Approving template: ${templateId} with category: ${categoryToSave}`);

      return new Promise(async (resolve, reject) => {
          try {
              const approveResponse = await fetch(`/api/templates/${templateId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ reviewed: true, category: categoryToSave }), // Add category to payload
              });

              if (!approveResponse.ok) {
                  const errorData = await approveResponse.json();
                  // Throw a more specific error if available, otherwise generic
                  const specificError = errorData.error || errorData.message;
                  throw new Error(specificError || `Failed to approve template (Status: ${approveResponse.status})`);
              }
              console.log('Approval successful.');

              // Remove from local state and clear its pending category update
              setUnreviewedTemplates(prev => prev.filter(t => t.id !== templateId));
              setPendingCategoryUpdates(prev => {
                const newUpdates = {...prev};
                delete newUpdates[templateId];
                return newUpdates;
              });
              toast.success(`Template "${template.name}" approved!`);
              resolve();
          } catch (err: any) {
              console.error('Approval failed:', err);
              toast.error(`Approval failed: ${err.message}`); // Display the specific error message
              reject(err);
          }
      });
  };

  // Saves changes (if any) AND THEN approves/removes
  const handleSaveAndApprove = async (templateId: string, newName: string, newInstructions: string): Promise<void> => {
      console.log('Attempting Save & Approve for:', templateId);
      return new Promise(async (resolve, reject) => {
        try {
            // Step 1: Attempt to save changes (this handles the "no changes" case internally)
            await handleSaveChangesOnly(templateId, newName, newInstructions);
            // If save succeeds (or no changes were needed)...

            // Step 2: Attempt to approve
            await handleApproveOnly(templateId);

            // If both steps complete without throwing error...
            resolve(); // Overall success
        } catch (err) {
            // Error toast is shown in individual handlers
            console.error('Save & Approve sequence failed:', err);
            reject(err); // Reject the overall promise
        }
      });
  };
  
  const handleDelete = async (templateId: string) => {
    const template = unreviewedTemplates.find(t => t.id === templateId);
    if (!template) return;

    if (window.confirm(`Are you sure you want to PERMANENTLY DELETE the template "${template.name}"? This cannot be undone.`)) {
      console.log('Deleting:', templateId);
      try {
        const response = await fetch(`/api/templates/${templateId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          // Check for specific error messages if API provides them
          let errorMsg = `Failed to delete template (Status: ${response.status})`
          try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorData.message || errorMsg;
          } catch (e) { /* Ignore parsing error */ }
          throw new Error(errorMsg);
        }

        // Remove from local state
        setUnreviewedTemplates(prev => prev.filter(t => t.id !== templateId));
        toast.success(`Template "${template.name}" deleted.`);
      } catch (err: any) {
        console.error('Deletion failed:', err);
        toast.error(`Deletion failed: ${err.message}`);
      }
    }
  };

  // --- Handlers for Preview/Crop Modal --- 
  const handlePreviewClick = (template: MemeTemplate | null) => {
    if (template && template.video_url) {
      setCurrentPreviewTemplate(template);
      setIsPreviewModalOpen(true);
    } else {
        toast.error('Cannot preview - video URL is missing.');
    }
  };

  const closePreviewModal = () => {
    setIsPreviewModalOpen(false);
    setCurrentPreviewTemplate(null);
  };

  // --- Updated Crop Complete Handler --- 
  const handleCropComplete = (templateId: string, updatedUrl?: string) => {
      console.log(`Crop completed for template ${templateId}.`);
      if (updatedUrl) {
          console.log(`Updating URL in local state to: ${updatedUrl}`);
          setUnreviewedTemplates(prevTemplates => 
              prevTemplates.map(template => 
                  template.id === templateId 
                      ? { ...template, video_url: updatedUrl } // Update the URL
                      : template
              )
          );
          toast.success('Template preview updated locally.'); // Optional feedback
      } else {
          // Fallback if URL wasn't passed back - refresh the whole list
          console.warn('Updated URL not provided after crop, refreshing full list as fallback.');
          handleRefreshClick(); 
      }
  };

  // --- NEW: Handler for Mark as Duplicate --- 
  const handleMarkAsDuplicate = async (templateId: string) => {
    const template = unreviewedTemplates.find(t => t.id === templateId);
    if (!template) return; 

    console.log('Marking as duplicate:', templateId);
    // Optional: Add a confirmation dialog
    // if (!window.confirm(`Mark "${template.name}" as a duplicate? It will be hidden from review.`)) {
    //   return;
    // }

    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_duplicate: true }),
      });

      if (!response.ok) {
        let errorMsg = `Failed to mark as duplicate (Status: ${response.status})`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorData.message || errorMsg;
        } catch (e) { /* Ignore parsing error */ }
        throw new Error(errorMsg);
      }

      // Remove from local state
      setUnreviewedTemplates(prev => prev.filter(t => t.id !== templateId));
      toast.success(`Template "${template.name}" marked as duplicate.`);

    } catch (err: any) {
      console.error('Mark as duplicate failed:', err);
      toast.error(`Failed to mark as duplicate: ${err.message}`);
    }
  };

  if (isLoading) {
    return (
        <div className={`${className} space-y-4 bg-gray-800 p-6 rounded-lg border border-gray-700 mt-8`}>
             <h2 className="text-xl font-bold text-white mb-4">Review Templates</h2>
             <div className="py-8 text-center text-gray-400">
                <svg className="animate-spin h-8 w-8 mx-auto mb-2 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p>Loading templates...</p>
            </div>
        </div>
    );
  }

  if (error) {
    return (
         <div className={`${className} space-y-4 bg-gray-800 p-6 rounded-lg border border-gray-700 mt-8`}>
             <h2 className="text-xl font-bold text-white mb-4">Review Templates</h2>
            <div className="text-red-400 text-sm p-3 bg-red-900/30 rounded border border-red-700">Error: {error}</div>
        </div>
    );
  }

  return (
    <div className={`${className} space-y-4 bg-gray-800 p-6 rounded-lg border border-gray-700 mt-8`}>
      <div className="flex justify-between items-center mb-4">
             {/* Display count in header */}
            <h2 className="text-xl font-bold text-white">Review Templates ({totalCount})</h2>
            <button
                onClick={handleRefreshClick}
                disabled={isLoading} // Only disable on full refresh, not load more
                className="px-4 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-wait transition-colors text-sm"
                >
                {isLoading && !isLoadingMore ? 'Refreshing...' : 'Refresh'} 
            </button>
        </div>
       
       {/* Loading state */}
       {isLoading && unreviewedTemplates.length === 0 && (
          <div className="py-8 text-center text-gray-400">
                <svg className="animate-spin h-8 w-8 mx-auto mb-2 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p>Loading templates...</p>
            </div>
       )}

       {/* Error state */}
       {!isLoading && error && (
          <div className="text-red-400 text-sm p-3 bg-red-900/30 rounded border border-red-700">Error: {error}</div>
       )}
       
       {/* Empty state */}
       {!isLoading && !error && totalCount === 0 && (
           <div className="py-8 text-center text-gray-400">
                <p>No templates are currently awaiting review.</p>
            </div>
       )}

       {/* Table display */}
       {!isLoading && unreviewedTemplates.length > 0 && (
          <div className="overflow-x-auto relative">
              <table className="w-full min-w-[800px] border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-700 text-left text-gray-300">
                    <th className="px-4 py-2 font-medium w-24">Preview</th>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Instructions</th>
                    <th className="px-4 py-2 font-medium w-28">Category</th>                  
                    <th className="px-4 py-2 font-medium">Source</th>
                    <th className="px-4 py-2 font-medium min-w-[200px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {unreviewedTemplates.map((template) => (
                    <tr key={template.id} className="hover:bg-gray-750 bg-gray-800">
                      {/* Preview Column */}
                       <td className="px-4 py-2 align-top">
                          <div 
                              className="w-24 h-16 bg-gray-700 rounded flex items-center justify-center text-gray-400 text-xs cursor-pointer border border-gray-600 hover:opacity-80 transition-opacity"
                              onClick={() => handlePreviewClick(template)} // Pass the whole template
                              title="Click to preview video"
                          >
                          {template.poster_url ? (
                              <img 
                                  src={template.poster_url} 
                                  alt="Preview" 
                                  className="w-full h-full object-cover rounded" 
                                  onError={(e) => { 
                                      e.currentTarget.style.display = 'none'; 
                                      e.currentTarget.parentElement?.querySelector('.fallback-text')?.classList.remove('hidden'); 
                                  }} 
                              />
                          ) : template.video_url ? (
                               <span className="fallback-text text-center p-1">Video (No Poster)</span>
                          ) : (
                               <span className="fallback-text">No Preview</span>
                          )}
                          <span className="fallback-text hidden absolute inset-0 flex items-center justify-center">No Preview</span>
                          </div>
                      </td>
                      {/* Name Column */}
                      <td className="px-4 py-2 align-top text-gray-300">
                         <div className="font-medium text-gray-100 whitespace-normal break-words max-w-xs">
                           {template.name}
                         </div>
                      </td>
                      {/* Instructions Column - UPDATED */}
                      <td className="px-4 py-2 align-top">
                        <div
                          className="p-3 bg-gray-700/60 rounded-md cursor-pointer hover:bg-gray-700/90 transition-colors" // Styles from MemeSelectorV2, removed border-t, mt-4, pt-4
                          onClick={() => handleEditClick(template)}
                          title="Click to edit name/instructions"
                        >
                          <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-3">
                            {template.instructions || <span className="italic text-gray-500">No instructions provided. Click to add.</span>}
                          </p>
                        </div>
                      </td>
                      {/* Category Column - NEW */} 
                      <td className="px-4 py-2 align-top">
                        <select 
                          value={pendingCategoryUpdates[template.id] ?? template.category ?? ""} 
                          onChange={(e) => {
                            setPendingCategoryUpdates(prev => ({
                              ...prev,
                              [template.id]: e.target.value === "" ? null : e.target.value 
                            }));
                          }}
                          className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs"
                        >
                          <option value="">None</option>
                          {AVAILABLE_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                      {/* Source Column */}
                       <td className="px-4 py-2 align-top text-gray-400">
                        {template.original_source_url ? (
                          <a
                            href={template.original_source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline truncate block max-w-[100px]"
                            title={template.original_source_url}
                          >
                            View Source
                          </a>
                        ) : (
                          <span className="text-gray-500">-'</span>
                        )}
                      </td>
                      {/* Actions Column */}
                      <td className="px-4 py-2 align-top">
                        <div className="flex flex-wrap gap-2 max-w-[180px]"> {/* Container for wrapping and gap */}
                            <button
                                onClick={() => handleEditClick(template)}
                                className="flex-1 px-3 py-1 text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 min-w-[70px] justify-center"
                                >
                                Edit
                                </button>
                                <button
                                onClick={() => handleApproveOnly(template.id)} // Use handleApproveOnly for the standalone button
                                className="flex-1 px-3 py-1 text-xs font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-emerald-500 min-w-[70px] justify-center"
                                >
                                Approve
                                </button>
                                {/* --- NEW: Duplicate Button --- */}
                                <button
                                    onClick={() => handleMarkAsDuplicate(template.id)}
                                    className="flex-1 px-3 py-1 text-xs font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-yellow-500 min-w-[70px] justify-center"
                                    title="Mark this template as a duplicate (hides from review)"
                                >
                                    Duplicate
                                </button>
                                <button
                                onClick={() => handleDelete(template.id)}
                                className="flex-1 px-3 py-1 text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 min-w-[70px] justify-center"
                                >
                                Delete
                            </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
       )}

        {/* Load More Button */} 
        {!isLoading && hasMore && (
            <div className="mt-6 text-center">
            <button
                onClick={handleLoadMoreClick}
                disabled={isLoadingMore}
                className="px-5 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-wait transition-colors text-sm font-medium"
            >
                {isLoadingMore ? 'Loading...' : 'Load More'}
            </button>
            </div>
        )}

      {/* Edit Template Modal */} 
      <EditTemplateModal 
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          template={currentEditingTemplate} 
          initialName={editModalInitialName}
          initialInstructions={editModalInitialInstructions}
          uploaderName={currentEditingTemplate?.uploader_name}
          onSaveChanges={handleSaveChangesOnly}
          onSaveAndApprove={handleSaveAndApprove}
          onReanalysisSubmitted={handleReanalysisSubmitted}
      />

      {/* New Preview/Crop Modal */} 
      <VideoPreviewCropModal 
          isOpen={isPreviewModalOpen}
          onClose={closePreviewModal}
          template={currentPreviewTemplate}
          onCropComplete={handleCropComplete}
      />
    </div>
  );
};

export default UnreviewedTemplatesTable; 