import React from 'react';

interface BackgroundSVGProps {
  width?: number;
  height?: number;
}

export default function BackgroundSVG({ width = 300, height = 300 }: BackgroundSVGProps) {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 1200 1200" 
      xmlns="http://www.w3.org/2000/svg"
      className="absolute"
      style={{ zIndex: -1 }}
    >
      <path 
        d="M600 0C268.6 0 0 268.6 0 600s268.6 600 600 600 600-268.6 600-600S931.4 0 600 0zm0 1000c-220.9 0-400-179.1-400-400s179.1-400 400-400 400 179.1 400 400-179.1 400-400 400z" 
        fill="rgba(70, 140, 255, 0.1)"
      />
      <circle cx="600" cy="600" r="300" fill="rgba(70, 140, 255, 0.05)" />
      <circle cx="600" cy="600" r="200" fill="rgba(70, 140, 255, 0.03)" />
      <circle cx="600" cy="600" r="100" fill="rgba(70, 140, 255, 0.02)" />
    </svg>
  );
} 