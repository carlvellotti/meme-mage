'use client';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useSupabase } from '@/app/components/SupabaseProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Provider } from '@supabase/supabase-js';
import { Database } from '@/lib/supabase/types';

export default function AuthPage() {
  const { supabase, session } = useSupabase();
  const router = useRouter();

  useEffect(() => {
    // Redirect to home if user is already logged in
    if (session) {
      router.push('/'); // Redirect to home page or dashboard
    }
  }, [session, router]);

  // Don't render Auth UI if session exists (avoids brief flash)
  if (session) {
    return null;
  }

  // Ensure supabase client is available before rendering Auth UI
  if (!supabase) {
    // You might want a more sophisticated loading state
    return <div>Loading authentication...</div>;
  }

  return (
    <div className="container mx-auto p-4 pt-10 max-w-md">
      <h1 className='text-2xl font-bold text-center mb-6'>Meme Mage Login</h1>
      <div className='bg-gray-800 p-8 rounded-lg shadow-lg'>
        <Auth
          supabaseClient={supabase}
          appearance={{ 
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#2563eb', // Blue-600 (Used for buttons)
                  brandAccent: '#1d4ed8', // Blue-700 (Button hover)
                  brandButtonText: 'white',
                  defaultButtonBackground: '#4b5563', // gray-600 (e.g., Sign in with Email button background)
                  defaultButtonBackgroundHover: '#374151', // gray-700
                  defaultButtonBorder: '#4b5563', // gray-600
                  defaultButtonText: 'white',
                  dividerBackground: '#4b5563', // gray-600
                  inputBackground: '#1f2937', // gray-800 or gray-900 for darker
                  inputBorder: '#4b5563', // gray-600
                  inputBorderHover: '#6b7280', // gray-500
                  inputBorderFocus: '#2563eb', // blue-600
                  inputText: 'white',
                  inputLabelText: '#d1d5db', // gray-300
                  inputPlaceholder: '#6b7280', // gray-500
                  messageText: '#d1d5db', // gray-300
                  messageTextDanger: '#f87171', // red-400
                  anchorTextColor: '#60a5fa', // blue-400
                  anchorTextHoverColor: '#93c5fd', // blue-300
                },
                space: {
                  spaceSmall: '4px',
                  spaceMedium: '8px',
                  spaceLarge: '16px',
                  labelBottomMargin: '8px',
                  anchorBottomMargin: '4px',
                  emailInputSpacing: '8px',
                  socialAuthSpacing: '8px',
                  buttonPadding: '10px 15px',
                  inputPadding: '10px 15px',
                },
                fontSizes: {
                  baseLabelSize: '14px',
                  baseInputSize: '14px',
                  baseButtonSize: '14px',
                  baseBodySize: '13px',
                },
                fonts: {
                  bodyFontFamily: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`,
                  buttonFontFamily: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`,
                  inputFontFamily: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`,
                  labelFontFamily: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`,
                },
                // Other variables like borders, radii etc. can be customized too
                // E.g., borders: { buttonBorderWidth: '1px', inputBorderWidth: '1px' }
                // E.g., radii: { borderRadiusButton: '6px', inputBorderRadius: '6px' }
              },
            },
          }}
          providers={['email'] as unknown as Provider[]}
          // Redirect is handled by session check in useEffect
          // theme="dark" // ThemeSupa handles dark mode based on CSS variables or prefers-color-scheme
        />
      </div>
    </div>
  );
} 