'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';

// Assume a fetcher function exists or define a simple one
// You might want a more robust fetcher in a shared utility file
const fetcher = (url: string) => fetch(url).then(async (res) => {
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'An error occurred while fetching data.');
  }
  const data = await res.json();
  return data.data; // Assuming API returns { data: [...] }
});

// Define the Persona type based on your DB schema (or import from supabase/types if defined)
interface Persona {
  id: string;
  name: string;
  description?: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface PersonaManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PersonaManager({ isOpen, onClose }: PersonaManagerProps) {
  const { data: personas, error, isLoading, mutate } = useSWR<Persona[]>('/api/personas', fetcher);

  const [isAdding, setIsAdding] = useState(false);
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Reset form state when opening/closing add/edit modes
  useEffect(() => {
    if (!isAdding && !editingPersonaId) {
      setNewName('');
      setNewDescription('');
    }
  }, [isAdding, editingPersonaId]);
  
  // Find the persona currently being edited
  const personaToEdit = personas?.find(p => p.id === editingPersonaId);
  useEffect(() => {
      if (personaToEdit) {
          setNewName(personaToEdit.name);
          setNewDescription(personaToEdit.description || '');
      } else {
           setNewName('');
           setNewDescription('');
      }
  }, [personaToEdit]);

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error('Persona name cannot be empty.');
      return;
    }
    const toastId = toast.loading('Adding persona...');
    try {
      const response = await fetch('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDescription }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to add persona');
      
      toast.success('Persona added!', { id: toastId });
      mutate(); // Revalidate persona list
      setIsAdding(false); // Close add form
    } catch (err: any) {
      console.error("Add Persona Error:", err);
      toast.error(err.message || 'Could not add persona.', { id: toastId });
    }
  };

  const handleUpdate = async (id: string) => {
     if (!newName.trim()) {
      toast.error('Persona name cannot be empty.');
      return;
    }
    const toastId = toast.loading('Updating persona...');
    try {
      const response = await fetch(`/api/personas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDescription }),
      });
      const result = await response.json();
       if (!response.ok) throw new Error(result.error || 'Failed to update persona');
       
      toast.success('Persona updated!', { id: toastId });
      mutate(); // Revalidate persona list
      setEditingPersonaId(null); // Close edit form
    } catch (err: any) {
      console.error("Update Persona Error:", err);
      toast.error(err.message || 'Could not update persona.', { id: toastId });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this persona and all associated feedback?')) {
        return;
    }
    const toastId = toast.loading('Deleting persona...');
    try {
      const response = await fetch(`/api/personas/${id}`, { method: 'DELETE' });
      const result = await response.json();
       if (!response.ok) throw new Error(result.error || 'Failed to delete persona');
       
      toast.success('Persona deleted!', { id: toastId });
      mutate(); // Revalidate persona list
    } catch (err: any) {
      console.error("Delete Persona Error:", err);
      toast.error(err.message || 'Could not delete persona.', { id: toastId });
    }
  };

  // Simple modal visibility control
  if (!isOpen) {
    return null;
  }

  const renderForm = (handleSubmit: () => void, submitLabel: string, cancelAction: () => void) => (
    <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
      <input
        type="text"
        placeholder="Persona Name *"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        className="w-full p-2 border border-gray-600 bg-gray-800 text-white rounded-md focus:ring-2 focus:ring-blue-500"
      />
      <textarea
        placeholder="Description (Optional)"
        value={newDescription}
        onChange={(e) => setNewDescription(e.target.value)}
        className="w-full p-2 border border-gray-600 bg-gray-800 text-white rounded-md focus:ring-2 focus:ring-blue-500"
        rows={3}
      />
      <div className="flex justify-end gap-2">
          <button onClick={cancelAction} className="py-1 px-3 text-sm bg-gray-600 hover:bg-gray-500 rounded">Cancel</button>
          <button onClick={handleSubmit} className="py-1 px-3 text-sm bg-blue-600 hover:bg-blue-700 rounded">{submitLabel}</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-xl font-semibold text-white">Manage Personas</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>

        {/* Add/Edit Form Area - Moved above list */} 
        <div className="flex-shrink-0">
            {isAdding && renderForm(handleAdd, 'Add Persona', () => setIsAdding(false))}
            {editingPersonaId && personaToEdit && renderForm(() => handleUpdate(editingPersonaId), 'Save Changes', () => setEditingPersonaId(null))}
        </div>
        
        {/* List Area */} 
        <div className="flex-grow overflow-y-auto mb-4 pr-2"> 
          {isLoading && <p className="text-gray-400 text-center py-4">Loading personas...</p>}
          {error && <p className="text-red-400 text-center py-4">Error loading personas: {error.message}</p>}
          {personas && personas.length === 0 && !isLoading && !isAdding && (
            <p className="text-gray-400 italic text-center py-4">No personas created yet. Click Add below.</p>
          )}
          {personas && personas.length > 0 && (
            <ul className="space-y-3">
              {personas.map((persona) => (
                <li key={persona.id} className="bg-gray-700 p-3 rounded flex justify-between items-start gap-3">
                  <div className="flex-grow min-w-0"> {/* Added min-w-0 for proper truncation */} 
                    <p className="font-medium text-white truncate">{persona.name}</p>
                    {/* Truncated description */} 
                    {persona.description && (
                        <p 
                          className="text-sm text-gray-400 mt-1 line-clamp-2 overflow-hidden" 
                          title={persona.description} // Show full description on hover
                        >
                          {persona.description}
                        </p>
                    )}
                  </div>
                  {/* Buttons appear only if no form is active */} 
                  {!isAdding && !editingPersonaId && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => setEditingPersonaId(persona.id)} className="text-xs py-1 px-2 bg-blue-600 hover:bg-blue-700 rounded">Edit</button>
                        <button onClick={() => handleDelete(persona.id)} className="text-xs py-1 px-2 bg-red-600 hover:bg-red-700 rounded">Delete</button>
                      </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

         {/* Button to Add - Moved to bottom */} 
        <div className="flex-shrink-0">
            {!isAdding && !editingPersonaId && (
                <button 
                    onClick={() => setIsAdding(true)} 
                    className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 rounded text-white"
                >
                    + Add New Persona
                </button>
            )}
        </div>

      </div>
    </div>
  );
} 