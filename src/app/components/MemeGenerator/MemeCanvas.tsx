import React from 'react';

interface MemeCanvasProps {
  previewCanvas: HTMLCanvasElement | null;
  isCropped: boolean;
  // selectedTemplate: MemeTemplate | null; // Optional: if needed for direct rendering decisions
}

const MemeCanvas: React.FC<MemeCanvasProps> = ({
  previewCanvas,
  isCropped,
  // selectedTemplate 
}) => {
  return (
    <div className={`relative ${isCropped ? 'aspect-auto bg-black' : 'aspect-[9/16] bg-black'} w-full rounded-lg overflow-hidden flex flex-col items-center justify-center`}>
      {previewCanvas ? (
        <img 
          src={previewCanvas.toDataURL()} 
          alt="Meme preview"
          className={`max-w-full ${isCropped ? 'h-auto' : 'h-full object-contain'}`}
        />
      ) : (
        <div className="text-gray-400">
          <p className="text-sm">Preview will appear here</p>
        </div>
      )}
    </div>
  );
};

export default MemeCanvas; 