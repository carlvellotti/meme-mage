import React from 'react';

interface FeedbackButtonsProps {
  onFeedback: (status: 'used' | 'dont_use') => void;
  isLoading: boolean;
  currentStatus: 'used' | 'dont_use' | null;
  // personaId and templateId are used to determine if feedback can be submitted,
  // but the parent component (MemeGenerator) will handle the conditional rendering of these buttons.
  // So, we might not need them as direct props if the parent already gates rendering.
  // However, if there's any logic within FeedbackButtons that depends on them (e.g. specific disabled states beyond isLoading),
  // they could be passed. For now, let's assume parent handles the render-gate.
}

const FeedbackButtons: React.FC<FeedbackButtonsProps> = ({ 
  onFeedback, 
  isLoading, 
  currentStatus 
}) => {
  return (
    <div className="mt-2 pt-4 border-t border-gray-600 space-x-2 flex justify-center">
      <button
        onClick={() => onFeedback('used')}
        disabled={isLoading}
        className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1 transition-all duration-150 ease-in-out 
          ${currentStatus === 'used' 
            ? 'bg-green-600 hover:bg-green-700 text-white ring-2 ring-offset-2 ring-offset-gray-800 ring-green-500' 
            : currentStatus === 'dont_use' 
              ? 'bg-green-800 hover:bg-green-700 text-green-300 opacity-60 hover:opacity-100' 
              : 'bg-green-600 hover:bg-green-700 text-white'
          } 
          disabled:opacity-50 disabled:cursor-not-allowed`}
        title="Mark this template as used/good for the selected persona"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        Used
      </button>
      <button
        onClick={() => onFeedback('dont_use')}
        disabled={isLoading}
          className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1 transition-all duration-150 ease-in-out 
          ${currentStatus === 'dont_use' 
            ? 'bg-red-600 hover:bg-red-700 text-white ring-2 ring-offset-2 ring-offset-gray-800 ring-red-500' 
            : currentStatus === 'used' 
              ? 'bg-red-800 hover:bg-red-700 text-red-300 opacity-60 hover:opacity-100' 
              : 'bg-red-600 hover:bg-red-700 text-white'
          } 
          disabled:opacity-50 disabled:cursor-not-allowed`}
        title="Mark this template as bad/don't use for the selected persona"
      >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        Don't Use
      </button>
    </div>
  );
};

export default FeedbackButtons; 