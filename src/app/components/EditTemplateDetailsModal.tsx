'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { MemeTemplate } from '@/lib/supabase/types'; // Adjust path if necessary
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

interface EditTemplateDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: MemeTemplate | null;
  onSave: (templateId: string, newName: string, newInstructions: string) => Promise<MemeTemplate | null>; // Callback to handle actual saving
}

const EditTemplateDetailsModal: React.FC<EditTemplateDetailsModalProps> = ({
  isOpen,
  onClose,
  template,
  onSave,
}) => {
  const [modalName, setModalName] = useState('');
  const [modalInstructions, setModalInstructions] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [initialName, setInitialName] = useState('');
  const [initialInstructions, setInitialInstructions] = useState('');
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);

  useEffect(() => {
    if (template) {
      const name = template.name || '';
      const instructions = template.instructions || '';
      setModalName(name);
      setModalInstructions(instructions);
      setInitialName(name); // Store initial values for change detection
      setInitialInstructions(instructions);
    } else {
      // Reset when template is null (e.g., modal closed)
      setModalName('');
      setModalInstructions('');
      setInitialName('');
      setInitialInstructions('');
    }
  }, [template]); // Rerun when the template changes

  if (!isOpen || !template) return null;

  const hasChanges = modalName !== initialName || modalInstructions !== initialInstructions;

  const handleSaveChangesClick = async () => {
      if (!hasChanges) {
          toast('No changes detected.');
          onClose(); // Close if no changes
          return;
      }
      setIsSaving(true);
      try {
          const updatedTemplate = await onSave(template.id, modalName, modalInstructions);
          if (updatedTemplate) { // Check if save was successful before closing
             onClose(); // Close modal on successful save (toast handled by parent)
          }
          // If onSave returns null or throws, modal stays open (error toast handled by parent)
      } catch (error) {
          console.error("Error saving changes (from modal component perspective):", error);
           // Error toast should be handled by the parent's onSave implementation
      } finally {
          setIsSaving(false);
      }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
          onClose();
      }
  };

  const handleCancelClick = () => {
      // Reset state to initial values before closing if desired, or just close
      // setModalName(initialName);
      // setModalInstructions(initialInstructions);
      onClose();
  };

  return (
    <div
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity duration-300 px-4 py-8"
        onClick={handleOverlayClick}
        aria-labelledby="edit-template-details-title"
        role="dialog"
        aria-modal="true"
    >
      <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full mx-auto relative shadow-xl border border-gray-700 flex flex-col max-h-[85vh]">
        <h3 id="edit-template-details-title" className="text-lg font-semibold text-white mb-4 flex-shrink-0">Edit Details: {initialName}</h3>

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
                Instructions / Description {isEditingInstructions ? '(Editing - Click outside to view)' : '(Click to edit)'}
            </label>
            {isEditingInstructions ? (
              <textarea
                  id="modal-template-instructions"
                  value={modalInstructions}
                  onChange={(e) => setModalInstructions(e.target.value)}
                  onBlur={() => setIsEditingInstructions(false)}
                  className="w-full p-3 border border-blue-500 bg-gray-700 text-white rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm resize-y flex-grow"
                  placeholder="Enter detailed instructions or description..."
                  style={{minHeight: '800px', maxHeight: '60vh'}}
                  autoFocus
              />
            ) : (
              <div
                  onClick={() => setIsEditingInstructions(true)}
                  className="w-full p-3 pb-6 border border-gray-600 bg-gray-700/60 text-white rounded-md text-sm flex-grow cursor-pointer hover:border-gray-500 overflow-y-auto prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5"
                  style={{minHeight: '800px', maxHeight: '60vh'}}
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

        {/* Modal Footer */}
        <div className="mt-auto flex justify-end space-x-3 flex-shrink-0 pt-4 border-t border-gray-700">
          <button
            type="button"
            onClick={handleCancelClick}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium rounded-md text-gray-300 bg-gray-600 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-400 disabled:opacity-50"
          >
            Cancel
          </button>
          {/* Save Changes Button */}
          <button
            type="button"
            onClick={handleSaveChangesClick}
            disabled={isSaving || !hasChanges}
            className="px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-wait"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditTemplateDetailsModal; 