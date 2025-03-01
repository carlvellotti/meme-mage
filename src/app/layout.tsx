import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navigation from './components/Navigation';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Meme Mage',
  description: 'Generate memes with AI',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
    other: {
      rel: 'icon',
      url: '/favicon.png',
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@700&family=Anton&family=Bebas+Neue&display=swap"
          rel="stylesheet"
        />
        <link 
          rel="icon" 
          href="/favicon.png" 
          type="image/png" 
          sizes="256x256"
        />
      </head>
      <body className={`min-h-screen bg-gray-50 ${inter.className}`}>
        <Navigation />
        <main className="container mx-auto px-4 md:px-8 lg:px-12 max-w-7xl">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
