import React from 'react';
import Image from 'next/image';
import VectorSVG from './Vector.svg';

interface BackgroundSVGProps {
  width?: number;
  height?: number;
}

const BackgroundSVG: React.FC<BackgroundSVGProps> = ({ 
  width = 500, 
  height = 400
}) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[-1]">
      <div style={{ transform: 'translateY(60px)' }}>
        <Image
          src={VectorSVG}
          alt="Background hands"
          width={width}
          height={height}
          priority
          className="opacity-20"
        />
      </div>
    </div>
  );
};

export default BackgroundSVG; 