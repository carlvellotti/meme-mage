import React from 'react';

interface CropToggleProps {
  isCropped: boolean;
  onToggleCrop: () => void;
  disabled: boolean;
}

const CropToggle: React.FC<CropToggleProps> = ({ isCropped, onToggleCrop, disabled }) => {
  if (disabled) {
    return null; // Don't render if disabled (e.g., in greenscreen mode)
  }

  return (
    <button
      onClick={onToggleCrop}
      className={`text-sm px-3 py-1 rounded-full ${
        isCropped 
          ? 'bg-blue-600 text-white hover:bg-blue-700' 
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
      title={isCropped ? "Expand video to full height" : "Crop video to compact size"}
      // The parent component will handle disabling this via the `disabled` prop based on isGreenscreenMode
    >
      {isCropped ? 'Uncrop' : 'Crop'}
    </button>
  );
};

export default CropToggle; 