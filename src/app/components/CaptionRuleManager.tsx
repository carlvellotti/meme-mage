'use client';

import React, { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import toast from 'react-hot-toast';
import { getDefaultCaptionRules } from '@/lib/utils/prompts';

// Define the interface for a Caption Rule Set (matching DB schema)
interface CaptionRule {
  id: string;
  user_id: string;
  name: string;
  rules_text: string;
  created_at: string;
  updated_at: string;
}

// Basic fetcher (consider moving to a shared utils file if not already done)
const fetcher = (url: string) => fetch(url).then(async (res) => {
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'An error occurred while fetching');
  }
  const result = await res.json();
  return result.data;
});

interface CaptionRuleManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CaptionRuleManager({ isOpen, onClose }: CaptionRuleManagerProps) {
  // --- State Variables ---
  const [mode, setMode] = useState<'list' | 'view_default' | 'edit' | 'add'>('list');
  const [selectedRuleSet, setSelectedRuleSet] = useState<CaptionRule | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [rulesInput, setRulesInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null); // For form-specific errors
  const [isDuplicating, setIsDuplicating] = useState(false); // Added for distinguishing duplication

  // --- Data Fetching ---
  const { 
    data: ruleSets, 
    error: fetchError, 
    isLoading, 
    mutate: mutateList // Rename mutate to avoid conflict later
  } = useSWR<CaptionRule[]>(isOpen ? '/api/caption-rules' : null, fetcher);

  const defaultRulesText = getDefaultCaptionRules();

  // --- Effects ---
  // Reset state when modal closes or mode changes back to list
  useEffect(() => {
    if (!isOpen || mode === 'list') {
      setSelectedRuleSet(null);
      setNameInput('');
      setRulesInput('');
      setIsSubmitting(false);
      setErrorMsg(null);
      setIsDuplicating(false); // Reset duplication flag
      if (mode !== 'list') setMode('list'); // Ensure mode resets if closing externally
    }
  }, [isOpen, mode]);

  // Populate form when switching to edit mode or adding
  useEffect(() => {
    if (mode === 'edit' && selectedRuleSet) {
      setNameInput(selectedRuleSet.name);
      setRulesInput(selectedRuleSet.rules_text);
    } else if (mode === 'add') {
      // If not duplicating, prefill new rule set with default rules or leave empty
      if (!isDuplicating) {
        setNameInput('');
        setRulesInput(defaultRulesText); // Or setRulesInput(''); based on desired default for new
      }
      // If isDuplicating, nameInput and rulesInput are already set by handleDuplicateRule
    }
  }, [mode, selectedRuleSet, defaultRulesText, isDuplicating]);

  // --- Event Handlers ---
  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    
    // Basic frontend validation
    if (!nameInput.trim()) {
      setErrorMsg('Rule set name cannot be empty.');
      return;
    }
    if (!rulesInput.trim()) {
      setErrorMsg('Rules text cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(mode === 'add' ? 'Adding rule set...' : 'Updating rule set...');

    const url = mode === 'add' ? '/api/caption-rules' : `/api/caption-rules/${selectedRuleSet?.id}`;
    const method = mode === 'add' ? 'POST' : 'PUT';
    const body = JSON.stringify({
      name: nameInput.trim(),
      rules_text: rulesInput.trim(),
    });

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${mode === 'add' ? 'add' : 'update'} rule set`);
      }

      toast.success(`Rule set ${mode === 'add' ? 'added' : 'updated'} successfully!`, { id: toastId });
      mutateList(); // Revalidate the list data
      setMode('list'); // Go back to list view

    } catch (err: any) {
      console.error('Save error:', err);
      setErrorMsg(err.message || 'An unexpected error occurred.');
      toast.error(err.message || 'Could not save rule set.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicateRule = (ruleToDuplicate: CaptionRule) => {
    setSelectedRuleSet(null); // Important: we are creating a new rule
    setNameInput(`${ruleToDuplicate.name} (Copy)`);
    setRulesInput(ruleToDuplicate.rules_text);
    setIsDuplicating(true); // Set duplication flag
    setMode('add'); // Switch to form view, but it's for a new (duplicated) rule
  };

  const handleDelete = async (id: string | undefined) => {
    if (!id) return;
    
    // Use window.confirm for simplicity, consider a custom confirm modal later
    if (!window.confirm('Are you sure you want to delete this rule set?')) {
      return;
    }

    const toastId = toast.loading('Deleting rule set...');
    setIsSubmitting(true); // Use submitting state to disable buttons during delete

    try {
      const response = await fetch(`/api/caption-rules/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete rule set');
      }

      toast.success('Rule set deleted successfully!', { id: toastId });
      mutateList(); // Revalidate the list
      // Stay in list mode

    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err.message || 'Could not delete rule set.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render Logic ---
  if (!isOpen) {
    return null; // Don't render anything if the modal is closed
  }
  
  const renderListContent = () => (
    <>
        {isLoading && <p className="text-gray-400 text-center py-4">Loading rule sets...</p>}
        {fetchError && <p className="text-red-400 text-center py-4">Error loading rule sets: {fetchError.message}</p>}
        {!isLoading && !fetchError && (
            <ul className="space-y-3">
            {/* Default Rules Item */}
            <li className="flex justify-between items-center p-3 bg-gray-700 rounded-md">
                <span className="text-gray-200 font-medium">Default Rules</span>
                <button
                onClick={() => setMode('view_default')}
                className="text-xs py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
                disabled={isSubmitting}
                >
                View
                </button>
            </li>
            {/* Custom Rules List */}
            {ruleSets?.map((rule) => (
                <li key={rule.id} className="flex justify-between items-center p-3 bg-gray-700 rounded-md">
                <span className="text-gray-200 truncate mr-2" title={rule.name}>{rule.name}</span>
                <div className="flex-shrink-0 space-x-2">
                    <button
                    onClick={() => { setSelectedRuleSet(rule); setMode('edit'); }}
                    className="text-xs py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50" // Changed color to blue
                    disabled={isSubmitting}
                    >
                    Edit
                    </button>
                    <button
                    onClick={() => handleDuplicateRule(rule)}
                    className="text-xs py-1 px-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-yellow-500"
                    disabled={isSubmitting}
                    >
                    Duplicate
                    </button>
                    <button
                    onClick={() => handleDelete(rule.id)}
                    className="text-xs py-1 px-2 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
                    disabled={isSubmitting}
                    >
                    Delete
                    </button>
                </div>
                </li>
            ))}
            {ruleSets?.length === 0 && (
                <p className="text-gray-400 text-center italic py-4">No custom rule sets found.</p>
            )}
            </ul>
        )}
    </>
  );

  const renderViewDefaultContent = () => (
     <>
        <pre className="whitespace-pre-wrap bg-gray-700 p-4 rounded-md text-gray-300 text-sm">
            {defaultRulesText}
        </pre>
    </>
  );

  const renderFormContent = () => (
      <form onSubmit={handleSave} className="space-y-3" id="captionRuleForm">
        <div>
          <label htmlFor="ruleSetName" className="block text-sm font-medium text-gray-300 mb-1">
            Rule Set Name ({mode === 'add' && isDuplicating ? 'Duplicating' : mode})
          </label>
          <input
            type="text"
            id="ruleSetName"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500"
            required
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label htmlFor="ruleSetText" className="block text-sm font-medium text-gray-300 mb-1">
            Key Rules
          </label>
          <textarea
            id="ruleSetText"
            value={rulesInput}
            onChange={(e) => setRulesInput(e.target.value)}
            className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 h-48"
            placeholder={mode === 'add' && isDuplicating ? 'Review and save duplicated rules' : "Enter key rules, one per line (e.g., starting with '-')"}
            required
            disabled={isSubmitting}
          />
            <p className="text-xs text-gray-400 mt-1">These rules will guide the AI caption generation.</p>
        </div>
        
        {errorMsg && <p className="text-sm text-red-400">Error: {errorMsg}</p>}

        {/* Form Actions are rendered outside this function */}
      </form>
  );

  // Basic Modal Structure
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-75 flex items-center justify-center p-4">
      {/* Adjusted width, height, and flex layout */}
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col relative">
        {/* Header */} 
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-xl font-semibold text-white">
            {mode === 'list' && 'Manage Caption Rules'}
            {mode === 'view_default' && 'Default Caption Rules'}
            {mode === 'add' && 'Add New Rule Set'}
            {mode === 'edit' && 'Edit Rule Set'}
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-200" 
            aria-label="Close modal"
            disabled={isSubmitting}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content Area */} 
        <div className="flex-grow overflow-y-auto mb-4 pr-2"> 
          {mode === 'list' && renderListContent()}
          {mode === 'view_default' && renderViewDefaultContent()}
          {(mode === 'add' || mode === 'edit') && renderFormContent()}
        </div>

        {/* Footer Actions */} 
        <div className="flex-shrink-0 border-t border-gray-700 pt-4">
          {mode === 'list' && (
            <button
              onClick={() => {
                setMode('add');
                setIsDuplicating(false); // Ensure this is false for a brand new rule
                setSelectedRuleSet(null); // Clear any selected rule
                // Name and rules text will be set by useEffect for 'add' mode if not duplicating
              }}
              className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md shadow-sm disabled:opacity-50"
              disabled={isSubmitting}
            >
              + Add New Rule Set
            </button>
          )}
          {mode === 'view_default' && (
            <button
              onClick={() => setMode('list')}
              className="py-1 px-3 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded-md"
            >
              Back to List
            </button>
          )}
          {(mode === 'add' || mode === 'edit') && (
            <div className="flex justify-end space-x-2">
               <button
                type="button"
                onClick={() => setMode('list')}
                className="py-1 px-3 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded-md disabled:opacity-50"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              {/* Trigger form submission via the form element's onSubmit */}
              <button
                type="submit" 
                form="captionRuleForm" // Assuming form gets id="captionRuleForm"
                className="py-1 px-3 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : (mode === 'add' ? 'Add Rule Set' : 'Save Changes')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 