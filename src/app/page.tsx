'use client';

import MemeGenerator from './components/MemeGenerator';
import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [isGreenscreenMode, setIsGreenscreenMode] = useState(false);
  
  return (
    <div className="py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-white">Meme Mage</h1>
        <p className="text-gray-300 mb-8">
          Create custom memes using AI. Enter your target audience and meme idea, and we'll help you generate the perfect meme.
          Or <Link href="/template-library" className="text-blue-400 hover:underline">browse our template library</Link> to create memes from specific templates.
        </p>
        <MemeGenerator 
          isGreenscreenMode={isGreenscreenMode} 
          onToggleMode={() => setIsGreenscreenMode(!isGreenscreenMode)} 
        />
      </div>
    </div>
  );
}