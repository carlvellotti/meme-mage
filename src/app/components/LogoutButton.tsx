'use client';

import { useSupabase } from '@/app/components/SupabaseProvider';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const { supabase } = useSupabase();
  const router = useRouter();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error);
      // Optionally show a toast message
    } else {
      // Redirect to login page after logout
      router.push('/auth');
      router.refresh(); // Ensure server components refresh state
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="py-2 px-4 text-sm rounded-md no-underline bg-red-600 hover:bg-red-700 text-white transition-colors"
    >
      Logout
    </button>
  );
} 