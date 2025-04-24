'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SupabaseClient, Session } from '@supabase/supabase-js';

// Define the shape of the context value
type SupabaseContextType = {
  supabase: SupabaseClient;
  session: Session | null;
};

// Create the context with an undefined initial value
const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

// Provider component
export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  // Initialize the Supabase client only once
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        setSession(session);
        setLoading(false);
      }
    }

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        console.log('Auth state changed:', event, session ? 'User Logged In' : 'User Logged Out');
        setSession(session);
        setLoading(false); // Ensure loading is false after initial check or change
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [supabase]);

  return (
    <SupabaseContext.Provider value={{ supabase, session }}>
      {!loading ? children : <div>Loading Auth...</div>} {/* Or a spinner component */}
    </SupabaseContext.Provider>
  );
}

// Custom hook to use the Supabase context
export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
}; 