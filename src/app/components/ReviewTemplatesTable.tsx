'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast'; // Assuming react-hot-toast is installed and configured

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
  // Add other relevant fields as needed from the actual type
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
  onSaveChanges: (templateId: string, newName: string, newInstructions: string) => Promise<MemeTemplate | null>; // Updated prop name and signature
  onSaveAndApprove: (templateId: string, newName: string, newInstructions: string) => Promise<void>; // Added prop
}

const EditTemplateModal: React.FC<EditTemplateModalProps> = ({ 
  isOpen,
  onClose,
  template,
  initialName,             
  initialInstructions,
  uploaderName,             
  onSaveChanges,       // Renamed prop
  onSaveAndApprove   // Added prop
}) => {
  const [modalName, setModalName] = useState(initialName);              
  const [modalInstructions, setModalInstructions] = useState(initialInstructions);
  const [isSaving, setIsSaving] = useState(false); // Generic saving state

  useEffect(() => {
    setModalName(initialName);
    setModalInstructions(initialInstructions);
  }, [initialName, initialInstructions]);


  if (!isOpen || !template) return null;

  const hasChanges = modalName !== initialName || modalInstructions !== initialInstructions;

  const handleSaveChangesClick = async () => {
      setIsSaving(true);
      try {
          await onSaveChanges(template.id, modalName, modalInstructions);
          onClose(); // Close modal on successful save
      } catch (error) {
          console.error("Error saving changes:", error);
          // Error toast handled in parent
      } finally {
          setIsSaving(false);
      }
  };

   const handleSaveAndApproveClick = async () => {
      setIsSaving(true);
      try {
          await onSaveAndApprove(template.id, modalName, modalInstructions);
          onClose(); // Close modal on successful save & approve
      } catch (error) {
          console.error("Error saving and approving:", error);
           // Error toast handled in parent
      } finally {
          setIsSaving(false);
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
      <div className="bg-gray-800 p-6 rounded-lg max-w-4xl w-full mx-auto relative shadow-xl border border-gray-700 flex flex-col max-h-[85vh]">
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

        {/* Instructions Textarea */}
         <div className="mb-4 flex-grow flex flex-col">
            <label htmlFor="modal-template-instructions" className="block text-sm font-medium text-gray-300 mb-1">
                Instructions
            </label>
            <textarea
                id="modal-template-instructions"
                value={modalInstructions}
                onChange={(e) => setModalInstructions(e.target.value)}
                className="w-full p-3 border border-gray-600 bg-gray-700 text-white rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm resize-y flex-grow"
                placeholder="Enter detailed instructions..."
                style={{minHeight: '450px'}} 
            />
        </div>

        {/* Modal Footer */}
        <div className="mt-auto flex justify-end space-x-3 flex-shrink-0 pt-4 border-t border-gray-700">
          <button
            onClick={onClose} 
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium rounded-md text-gray-300 bg-gray-600 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-400 disabled:opacity-50"
          >
            Cancel
          </button>
          {/* Save Changes Button */}
          <button
            onClick={handleSaveChangesClick}
            disabled={isSaving || !hasChanges} // Disable if saving or no changes
            className="px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-wait"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
           {/* Save & Approve Button */}
          <button
            onClick={handleSaveAndApproveClick}
            disabled={isSaving} // Only disable if currently saving
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

const UnreviewedTemplatesTable: React.FC<UnreviewedTemplatesTableProps> = ({ 
    className,
    refreshTrigger = 0 
}) => {
  const [unreviewedTemplates, setUnreviewedTemplates] = useState<MemeTemplate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true); // For initial load / refresh
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false); // For loading more
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalVideoUrl, setModalVideoUrl] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentEditingTemplate, setCurrentEditingTemplate] = useState<MemeTemplate | null>(null);
  const [editModalInitialName, setEditModalInitialName] = useState('');
  const [editModalInitialInstructions, setEditModalInitialInstructions] = useState('');

  const fetchUnreviewedTemplates = async (pageToFetch = 1, loadMore = false) => {
    console.log(`Fetching unreviewed templates: page=${pageToFetch}, loadMore=${loadMore}`);
    
    if (loadMore) {
        setIsLoadingMore(true);
    } else {
        setIsLoading(true);
        setUnreviewedTemplates([]); // Clear existing on refresh/initial
        setCurrentPage(1); // Reset page on refresh/initial
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

  // Handle Load More click
  const handleLoadMoreClick = () => {
      if (hasMore && !isLoadingMore) {
          fetchUnreviewedTemplates(currentPage + 1, true); // Fetch next page
      }
  };

  const handleEditClick = (template: MemeTemplate) => {
    // Set state for edit modal
    setCurrentEditingTemplate(template);
    setEditModalInitialName(template.name);
    setEditModalInitialInstructions(template.instructions || '');
    setIsEditModalOpen(true);
    // No longer setting inline edit state
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
      if (!template) return Promise.reject(new Error("Template not found locally")); // Should not happen

      console.log('Approving template:', templateId);

      return new Promise(async (resolve, reject) => {
          try {
              const approveResponse = await fetch(`/api/templates/${templateId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ reviewed: true }),
              });

              if (!approveResponse.ok) {
                  const errorData = await approveResponse.json();
                  throw new Error(errorData.error || `Failed to approve template (Status: ${approveResponse.status})`);
              }
              console.log('Approval successful.');

              // Remove from local state
              setUnreviewedTemplates(prev => prev.filter(t => t.id !== templateId));
              toast.success(`Template "${template.name}" approved!`);
              resolve();
          } catch (err: any) {
              console.error('Approval failed:', err);
              toast.error(`Approval failed: ${err.message}`);
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

  // ... existing handleApprove and handleDelete logic ...
  const handleApprove = async (templateId: string) => {
    const template = unreviewedTemplates.find(t => t.id === templateId);
    if (!template) return;

    console.log('Approving:', templateId);
    
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed: true }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to approve template (Status: ${response.status})`);
      }

      // Remove from local state
      setUnreviewedTemplates(prev => prev.filter(t => t.id !== templateId));
      toast.success(`Template "${template.name}" approved!`);
    } catch (err: any) {
      console.error('Approval failed:', err);
      toast.error(`Approval failed: ${err.message}`);
    }
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

  // ... existing modal handlers (handlePreviewClick, closeModal) ...
  // Open modal handler
  const handlePreviewClick = (videoUrl: string | null) => {
    if (videoUrl) {
      setModalVideoUrl(videoUrl);
      setIsModalOpen(true);
    }
  };

  // Close modal handler
  const closeModal = () => {
    setIsModalOpen(false);
    setModalVideoUrl(null);
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
                              onClick={() => handlePreviewClick(template.video_url)} 
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
                      {/* Instructions Column */}
                      <td className="px-4 py-2 align-top text-gray-300">
                        <div className="text-gray-300 whitespace-pre-wrap max-w-sm text-xs line-clamp-4" title={template.instructions}>
                          {template.instructions || <span className="text-gray-500 italic">No instructions</span>}
                        </div>
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
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => handleEditClick(template)} 
                                className="px-3 py-1 text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
                                >
                                Edit
                                </button>
                                <button
                                onClick={() => handleApproveOnly(template.id)} // Use handleApproveOnly for the standalone button
                                className="px-3 py-1 text-xs font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-emerald-500"
                                >
                                Approve
                                </button>
                                <button
                                onClick={() => handleDelete(template.id)}
                                className="px-3 py-1 text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500"
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

      {/* Video Preview Modal */} 
       {isModalOpen && modalVideoUrl && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity duration-300"
          onClick={closeModal}
        >
          <div 
            className="bg-gray-900 p-4 rounded-lg max-w-3xl w-full mx-4 relative shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={closeModal}
              className="absolute top-2 right-2 text-gray-400 hover:text-white text-2xl leading-none"
              aria-label="Close video preview"
            >
              &times;
            </button>
            <video 
              src={modalVideoUrl} 
              controls 
              autoPlay
              className="w-full max-h-[80vh] rounded"
            >
              Your browser does not support the video tag.
            </video>
          </div>
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
            onSaveChanges={handleSaveChangesOnly} // Pass Save Changes handler
            onSaveAndApprove={handleSaveAndApprove} // Pass Save & Approve handler
        />
    </div>
  );
};

export default UnreviewedTemplatesTable; 