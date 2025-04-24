'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useSupabase } from '@/app/components/SupabaseProvider';
import LogoutButton from './LogoutButton';

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { session } = useSupabase();

  const routes = [
    { path: '/', label: 'Home' },
    ...(session ? [{ path: '/meme-v2', label: 'Create V2' }] : []),
    { path: '/template-library', label: 'Template Library' },
    { path: '/upload', label: 'Upload Template' },
  ];

  // Check if the current path is a template-specific page
  const isTemplatePage = pathname.startsWith('/template/');
  
  // If on a template page, show "Template Library" as the current page in mobile view
  const currentPageLabel = isTemplatePage 
    ? 'Template Library' 
    : (routes.find(route => route.path === pathname)?.label || 'Home');

  return (
    <nav className="border-b border-gray-800 bg-black">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-6xl">
        <Link href="/" className="text-2xl font-bold text-white">
          Meme Mage
        </Link>

        {/* Combined Desktop Navigation & Auth */}
        <div className="hidden md:flex items-center space-x-6">
          {routes.map(route => (
            <Link
              key={route.path}
              href={route.path}
              className={`relative py-2 text-sm font-medium transition-colors
                ${(pathname === route.path || (isTemplatePage && route.path === '/template-library') || (pathname === '/meme-v2' && route.path === '/meme-v2'))
                  ? 'text-blue-400' 
                  : 'text-gray-300 hover:text-white'
                }
                ${(pathname === route.path || (isTemplatePage && route.path === '/template-library') || (pathname === '/meme-v2' && route.path === '/meme-v2'))
                  ? 'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-400' 
                  : ''
                }
              `}
            >
              {route.label}
            </Link>
          ))}
          {/* Conditional Login/Logout Button */}
          {session ? (
            <LogoutButton />
          ) : (
            <Link 
              href="/auth"
              className="py-2 px-4 text-sm rounded-md no-underline bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              Login
            </Link>
          )}
        </div>

        {/* Mobile Navigation Button */}
        <div className="md:hidden relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center space-x-1 text-gray-300"
          >
            {/* Display current page or Login if not authenticated and on auth page */}
            <span>{session ? currentPageLabel : (pathname === '/auth' ? 'Login' : currentPageLabel)}</span>
            <svg
              className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Mobile Dropdown Menu */}
          {isOpen && (
            <div className="absolute right-0 mt-2 py-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50">
              {/* Show routes only if logged in, otherwise just Login/Signup */}
              {session ? (
                <>
                  {routes.map(route => (
                    <Link
                      key={route.path}
                      href={route.path}
                      className={`block px-4 py-2 text-sm ${
                        (pathname === route.path || (isTemplatePage && route.path === '/template-library') || (pathname === '/meme-v2' && route.path === '/meme-v2'))
                          ? 'bg-gray-700 text-white font-medium'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                      onClick={() => setIsOpen(false)}
                    >
                      {route.label}
                    </Link>
                  ))}
                  <div className="border-t border-gray-700 my-1"></div>
                  {/* Logout Button in Mobile Dropdown */}
                  <div className="px-4 py-2">
                    <LogoutButton />
                  </div>
                </>
              ) : (
                // Show Login/Signup Link if not logged in
                <Link
                  href="/auth"
                  className={`block px-4 py-2 text-sm ${pathname === '/auth' ? 'bg-gray-700 text-white font-medium' : 'text-gray-300 hover:bg-gray-700'}`}
                  onClick={() => setIsOpen(false)}
                >
                  Login / Sign Up
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
} 