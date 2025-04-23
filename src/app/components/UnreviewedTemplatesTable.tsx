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
  // Add other relevant fields as needed from the actual type
}

interface UnreviewedTemplatesTableProps {
  className?: string;
  refreshTrigger?: number; // Optional prop to trigger refresh when value changes
}

// --- Edit Template Modal Component ---
interface EditTemplateModalProps { // Renamed
  isOpen: boolean;
  onClose: () => void;
  template: MemeTemplate | null;
  initialName: string;          // Added
  initialInstructions: string;
  onSave: (templateId: string, newName: string, newInstructions: string) => Promise<void>; // Updated signature
}

const EditTemplateModal: React.FC<EditTemplateModalProps> = ({ // Renamed
  isOpen,
  onClose,
  template,
  initialName,              // Added
  initialInstructions,
  onSave 
}) => {
  const [modalName, setModalName] = useState(initialName);              // Added
  const [modalInstructions, setModalInstructions] = useState(initialInstructions);
  const [isSavingModal, setIsSavingModal] = useState(false);

  // Update state if initial values change (when opening for a different template)
  useEffect(() => {
    setModalName(initialName);
    setModalInstructions(initialInstructions);
  }, [initialName, initialInstructions]);

  if (!isOpen || !template) return null;

  const hasChanges = modalName !== initialName || modalInstructions !== initialInstructions;

  const handleModalSave = async () => {
      if (!hasChanges) return; // Should not happen if button is disabled, but double-check
      
      setIsSavingModal(true);
      try {
          // Pass both potentially updated values to the save handler
          await onSave(template.id, modalName, modalInstructions);
          onClose(); // Close modal on successful save
      } catch (error) {
          // Error toast is handled in the parent's onSave function
          console.error("Error saving from modal:", error);
      } finally {
          setIsSavingModal(false);
      }
  };

  // Close modal when clicking the background overlay
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
          onClose();
      }
  };

  return (
    // Added overlay click handler
    <div 
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity duration-300 px-4 py-8"
        onClick={handleOverlayClick} 
    >
      {/* Increased max-width and added height constraints */}
      <div className="bg-gray-800 p-6 rounded-lg max-w-4xl w-full mx-auto relative shadow-xl border border-gray-700 flex flex-col max-h-[85vh]">
        <h3 className="text-lg font-semibold text-white mb-4 flex-shrink-0">Edit Template: {initialName}</h3>
        
        {/* Added Name input field */}
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

        {/* Instructions Textarea - Now takes remaining space */}
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
                style={{minHeight: '450px'}} // Increased minHeight significantly
            />
        </div>

        {/* Modal Footer */}
        <div className="mt-auto flex justify-end space-x-3 flex-shrink-0 pt-4 border-t border-gray-700">
          <button
            onClick={onClose} 
            disabled={isSavingModal}
            className="px-4 py-2 text-sm font-medium rounded-md text-gray-300 bg-gray-600 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-400 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleModalSave}
            disabled={isSavingModal || !hasChanges} // Disable if no changes or saving
            className="px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 disabled:opacity-50 disabled:cursor-wait"
          >
            {isSavingModal ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
// --- End Edit Template Modal Component ---

const UnreviewedTemplatesTable: React.FC<UnreviewedTemplatesTableProps> = ({ 
    className,
    refreshTrigger = 0 // Default value
}) => {
  const [unreviewedTemplates, setUnreviewedTemplates] = useState<MemeTemplate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false); // For video preview
  const [modalVideoUrl, setModalVideoUrl] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); 
  const [currentEditingTemplate, setCurrentEditingTemplate] = useState<MemeTemplate | null>(null);
  const [editModalInitialName, setEditModalInitialName] = useState(''); 
  const [editModalInitialInstructions, setEditModalInitialInstructions] = useState(''); 

  const fetchUnreviewedTemplates = async () => {
    console.log('Fetching/Refreshing unreviewed templates...');
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/templates?reviewed=false');

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

      const data = await response.json();
      console.log('API Response Data for Unreviewed Templates:', data);

      if (Array.isArray(data)) {
        setUnreviewedTemplates(data);
      } else {
        console.error('API did not return an array:', data);
        setUnreviewedTemplates([]);
        throw new Error('Received invalid data format from the server.');
      }

    } catch (err: any) {
      console.error("Failed to fetch unreviewed templates:", err);
      setError(err.message || 'Failed to load templates. Please try again later.');
      setUnreviewedTemplates([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on initial mount
  useEffect(() => {
    fetchUnreviewedTemplates();
  }, []);

  // Fetch when refreshTrigger prop changes
  useEffect(() => {
    if (refreshTrigger > 0) { // Avoid re-fetching on initial mount if trigger starts at 0
        console.log('Refresh trigger changed, re-fetching unreviewed templates...');
        fetchUnreviewedTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]); 

  const handleRefreshClick = () => {
    fetchUnreviewedTemplates();
    toast.success('Refreshed review list');
  };

  const handleEditClick = (template: MemeTemplate) => {
    // Set state for edit modal
    setCurrentEditingTemplate(template);
    setEditModalInitialName(template.name);
    setEditModalInitialInstructions(template.instructions || '');
    setIsEditModalOpen(true);
    // No longer setting inline edit state
  };

  // Removed handleCancelClick (no longer needed for inline)
  // Removed handleSaveName (no longer needed for inline)

  // Combined save handler for the modal
  const handleSaveModal = async (templateId: string, newName: string, newInstructions: string): Promise<void> => {
      console.log('Saving changes from modal for:', templateId, { name: newName, instructions: newInstructions });
      const originalTemplate = unreviewedTemplates.find(t => t.id === templateId);
      const payload: Partial<MemeTemplate> = {};

      if (newName !== originalTemplate?.name) {
          payload.name = newName;
      }
      if (newInstructions !== (originalTemplate?.instructions || '')) {
          payload.instructions = newInstructions;
      }

      if (Object.keys(payload).length === 0) {
          toast('No changes detected in modal.');
          return Promise.resolve(); // Resolve immediately if no changes
      }

      // We wrap the core logic in a promise to handle async in the modal
      return new Promise(async (resolve, reject) => {
          try {
              const response = await fetch(`/api/templates/${templateId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload), // Send combined payload
              });

              if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.error || `Failed to save changes (Status: ${response.status})`);
              }

              const savedTemplate: MemeTemplate = await response.json();

              // Update local state
              setUnreviewedTemplates(prev =>
                  prev.map(t => t.id === templateId ? { ...t, ...savedTemplate } : t)
              );

              toast.success('Template updated successfully!');
              resolve(); // Resolve the promise on success
          } catch (err: any) {
              console.error('Modal save failed:', err);
              toast.error(`Save failed: ${err.message}`);
              reject(err); // Reject the promise on error
          }
      });
  };

  // Removed handleSaveInstructions (logic merged into handleSaveModal)

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
            <h2 className="text-xl font-bold text-white">Review Templates</h2>
            <button
                onClick={handleRefreshClick}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-wait transition-colors text-sm"
                >
                {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
        </div>
       {unreviewedTemplates.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            <p>No templates are currently awaiting review.</p>
          </div>
        ) : (
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
                    // No longer checking editingTemplateId for row styling
                    <tr key={template.id} className="hover:bg-gray-750 bg-gray-800">
                      {/* Preview Column - unchanged */} 
                       <td className="px-4 py-2 align-top">
                          <div 
                              className="w-24 h-16 bg-gray-700 rounded flex items-center justify-center text-gray-400 text-xs cursor-pointer border border-gray-600 hover:opacity-80 transition-opacity"
                              onClick={() => handlePreviewClick(template.video_url)} // Use video_url for modal
                              title="Click to preview video"
                          >
                          {template.poster_url ? (
                              <img 
                                  src={template.poster_url} 
                                  alt="Preview" 
                                  className="w-full h-full object-cover rounded" 
                                  // Basic error handling for image
                                  onError={(e) => { 
                                      e.currentTarget.style.display = 'none'; 
                                      e.currentTarget.parentElement?.querySelector('.fallback-text')?.classList.remove('hidden'); 
                                  }} 
                              />
                          ) : template.video_url ? (
                              // Display something indicating video exists if no poster
                               <span className="fallback-text text-center p-1">Video (No Poster)</span>
                          ) : (
                               <span className="fallback-text">No Preview</span>
                          )}
                          {/* Hidden fallback text for image error */}
                          <span className="fallback-text hidden absolute inset-0 flex items-center justify-center">No Preview</span>
                          </div>
                      </td>
                      {/* Name Column - No longer has inline edit */} 
                      <td className="px-4 py-2 align-top text-gray-300">
                         <div className="font-medium text-gray-100 whitespace-normal break-words max-w-xs">
                           {template.name}
                         </div>
                      </td>
                      {/* Instructions Column - No longer has inline edit */} 
                      <td className="px-4 py-2 align-top text-gray-300">
                        <div className="text-gray-300 whitespace-pre-wrap max-w-sm text-xs line-clamp-4" title={template.instructions}>
                          {template.instructions || <span className="text-gray-500 italic">No instructions</span>}
                        </div>
                      </td>
                      {/* Source Column - unchanged */} 
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
                      {/* Actions Column - No longer has inline edit buttons */} 
                      <td className="px-4 py-2 align-top">
                        <div className="flex items-center space-x-2">
                            {/* Only show standard Edit/Approve/Delete */}
                            <button
                                onClick={() => handleEditClick(template)} // Opens the combined modal
                                className="px-3 py-1 text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
                                >
                                Edit
                                </button>
                                <button
                                onClick={() => handleApprove(template.id)}
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

      {/* Video Preview Modal - unchanged */} 
       {isModalOpen && modalVideoUrl && (
         // ... modal JSX ...
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
              autoPlay // Add autoplay for convenience
              className="w-full max-h-[80vh] rounded"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}

       {/* Edit Template Modal (Renamed and updated) */}
        <EditTemplateModal 
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            template={currentEditingTemplate} 
            initialName={editModalInitialName}
            initialInstructions={editModalInitialInstructions}
            onSave={handleSaveModal} // Pass the combined save handler
        />
    </div>
  );
};

export default UnreviewedTemplatesTable; 