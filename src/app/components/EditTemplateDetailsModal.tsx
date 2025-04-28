'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { MemeTemplate } from '@/lib/supabase/types'; // Adjust path if necessary

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

        {/* Instructions Textarea */}
         <div className="mb-4 flex-grow flex flex-col">
            <label htmlFor="modal-template-instructions" className="block text-sm font-medium text-gray-300 mb-1">
                Instructions / Description
            </label>
            <textarea
                id="modal-template-instructions"
                value={modalInstructions}
                onChange={(e) => setModalInstructions(e.target.value)}
                className="w-full p-3 border border-gray-600 bg-gray-700 text-white rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm resize-y flex-grow"
                placeholder="Enter detailed instructions or description..."
                style={{minHeight: '250px'}} // Adjusted min height
            />
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
            disabled={isSaving || !hasChanges} // Disable if saving or no changes
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