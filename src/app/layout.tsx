import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navigation from './components/Navigation';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Meme Mage',
  description: 'Generate memes with AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Generate a timestamp to force favicon refresh
  const timestamp = Date.now();
  
  return (
    <html lang="en" className="dark">
      <head>
        {/* 
          Favicon troubleshooting notes:
          - Created valid favicon.png (256x256) in public directory
          - Confirmed favicon works in test-favicon.html directly
          - Tried metadata approach in Next.js config (removed due to potential conflicts)
          - Added direct link tag with timestamp to bypass caching
          - Issue persists in main application despite favicon being valid
          - Possible remaining issues: browser-specific caching, Next.js asset handling
        */}
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@700&family=Anton&family=Bebas+Neue&display=swap"
          rel="stylesheet"
        />
        <link 
          rel="icon" 
          href={`/favicon.png?v=${timestamp}`}
          type="image/png" 
          sizes="256x256"
        />
      </head>
      <body className={`min-h-screen bg-gray-900 text-gray-100 ${inter.className}`}>
        <Navigation />
        <main className="container mx-auto px-4 md:px-8 lg:px-12 max-w-7xl">
          {children}
        </main>
        <Toaster 
          toastOptions={{
            style: {
              background: '#374151', // gray-700
              color: '#F3F4F6', // gray-100
              borderRadius: '0.375rem',
            },
          }}
        />
      </body>
    </html>
  );
}
