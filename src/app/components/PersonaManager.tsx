'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';

// Assume fetcher is defined elsewhere or use the simple one:
const fetcher = (url: string) => fetch(url).then(async (res) => {
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'An error occurred while fetching data.');
  }
  const data = await res.json();
  return data.data; // Assuming API returns { data: [...] }
});

// Define the Persona type
interface Persona {
  id: string;
  name: string;
  description?: string | null;
  // Add other fields if needed from DB
}

interface PersonaManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PersonaManager({ isOpen, onClose }: PersonaManagerProps) {
  const { 
    data: personas, 
    error: fetchError, 
    isLoading, 
    mutate: mutateList 
  } = useSWR<Persona[]>(isOpen ? '/api/personas' : null, fetcher);

  // --- State --- 
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null); // Form specific error

  // --- Effects --- 
  // Reset state on close or mode change to list
  useEffect(() => {
    if (!isOpen || mode === 'list') {
      setSelectedPersona(null);
      setNameInput('');
      setDescriptionInput('');
      setIsSubmitting(false);
      setErrorMsg(null);
      if (mode !== 'list') setMode('list');
    }
  }, [isOpen, mode]);

  // Populate form when switching to edit mode
  useEffect(() => {
    if (mode === 'edit' && selectedPersona) {
      setNameInput(selectedPersona.name);
      setDescriptionInput(selectedPersona.description || '');
    } else if (mode === 'add') {
      // Clear form for adding
      setNameInput(''); 
      setDescriptionInput('');
    }
  }, [mode, selectedPersona]);

  // --- Event Handlers ---
  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);

    if (!nameInput.trim()) {
      setErrorMsg('Persona name cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(mode === 'add' ? 'Adding persona...' : 'Updating persona...');

    const url = mode === 'add' ? '/api/personas' : `/api/personas/${selectedPersona?.id}`;
    const method = mode === 'add' ? 'POST' : 'PUT';
    const body = JSON.stringify({
      name: nameInput.trim(),
      description: descriptionInput.trim() || null, // Send null if empty
    });

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Failed to ${mode === 'add' ? 'add' : 'update'} persona`);
      
      toast.success(`Persona ${mode === 'add' ? 'added' : 'updated'} successfully!`, { id: toastId });
      mutateList(); // Revalidate persona list
      setMode('list'); // Back to list

    } catch (err: any) {
      console.error("Save Persona Error:", err);
      setErrorMsg(err.message || 'Could not save persona.');
      toast.error(err.message || 'Could not save persona.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string | undefined) => {
    if (!id) return;

    if (!window.confirm('Are you sure you want to delete this persona and all associated feedback?')) {
        return;
    }

    setIsSubmitting(true); // Disable buttons during delete
    const toastId = toast.loading('Deleting persona...');
    try {
      const response = await fetch(`/api/personas/${id}`, { method: 'DELETE' });
      const result = await response.json();
       if (!response.ok) throw new Error(result.error || 'Failed to delete persona');
       
      toast.success('Persona deleted!', { id: toastId });
      mutateList(); // Revalidate persona list
      // Stay in list mode
    } catch (err: any) {
      console.error("Delete Persona Error:", err);
      toast.error(err.message || 'Could not delete persona.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render Functions ---
  const renderListContent = () => (
     <>
        {isLoading && <p className="text-gray-400 text-center py-4">Loading personas...</p>}
        {fetchError && <p className="text-red-400 text-center py-4">Error loading personas: {fetchError.message}</p>}
        {!isLoading && !fetchError && (
            <ul className="space-y-3">
            {personas?.map((persona) => (
                <li key={persona.id} className="bg-gray-700 p-3 rounded flex justify-between items-start gap-3">
                    <div className="flex-grow min-w-0"> 
                    <p className="font-medium text-white truncate">{persona.name}</p>
                    {persona.description && (
                        <p 
                            className="text-sm text-gray-400 mt-1 line-clamp-2 overflow-hidden" 
                            title={persona.description}
                        >
                            {persona.description}
                        </p>
                    )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <button 
                            onClick={() => { setSelectedPersona(persona); setMode('edit'); }}
                            className="text-xs py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
                            disabled={isSubmitting}
                        >
                            Edit
                        </button>
                        <button 
                            onClick={() => handleDelete(persona.id)}
                            className="text-xs py-1 px-2 bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
                            disabled={isSubmitting}
                        >
                            Delete
                        </button>
                    </div>
                </li>
            ))}
            {personas?.length === 0 && (
                <p className="text-gray-400 italic text-center py-4">No personas created yet. Click Add below.</p>
            )}
            </ul>
        )}
    </>
  );

  const renderFormContent = () => (
    <form onSubmit={handleSave} className="space-y-3" id="personaForm">
      <div>
        <label htmlFor="personaName" className="block text-sm font-medium text-gray-300 mb-1">
            Persona Name *
        </label>
        <input
            id="personaName"
            type="text"
            placeholder="Persona Name *"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500"
            required
            disabled={isSubmitting}
        />
      </div>
      <div>
         <label htmlFor="personaDescription" className="block text-sm font-medium text-gray-300 mb-1">
            Description (Optional)
        </label>
        <textarea
            id="personaDescription"
            placeholder="Description (Optional)"
            value={descriptionInput}
            onChange={(e) => setDescriptionInput(e.target.value)}
            className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 h-48"
            disabled={isSubmitting}
        />
      </div>
       {errorMsg && <p className="text-sm text-red-400">Error: {errorMsg}</p>}
        {/* Actions are rendered outside this function */}
    </form>
  );

  // --- Main Return --- 
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */} 
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-xl font-semibold text-white">
            {mode === 'list' && 'Manage Personas'}
            {mode === 'add' && 'Add New Persona'}
            {mode === 'edit' && 'Edit Persona'}
          </h2>
          <button 
             onClick={onClose} 
             className="text-gray-400 hover:text-white disabled:opacity-50"
             disabled={isSubmitting}
           >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        {/* Content Area */} 
        <div className="flex-grow overflow-y-auto mb-4 pr-2"> 
          {mode === 'list' && renderListContent()}
          {(mode === 'add' || mode === 'edit') && renderFormContent()}
        </div>
        
        {/* Footer Actions */} 
        <div className="flex-shrink-0 border-t border-gray-700 pt-4">
            {mode === 'list' && (
                 <button 
                    onClick={() => setMode('add')} 
                    className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 rounded text-white disabled:opacity-50"
                    disabled={isSubmitting}
                >
                    + Add New Persona
                </button>
            )}
            {(mode === 'add' || mode === 'edit') && (
                <div className="flex justify-end gap-2">
                    <button 
                        type="button"
                        onClick={() => setMode('list')} 
                        className="py-1 px-3 text-sm bg-gray-600 hover:bg-gray-500 rounded text-white disabled:opacity-50"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        form="personaForm" // Link to form ID
                        className="py-1 px-3 text-sm bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50"
                        disabled={isSubmitting}
                     >
                        {isSubmitting ? 'Saving...' : (mode === 'add' ? 'Add Persona' : 'Save Changes')}
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
} 