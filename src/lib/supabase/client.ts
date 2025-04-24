import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from './types';

// Renamed function for clarity and consistency with new helper names
export const createClient = () => createClientComponentClient<Database>();

// Remove old code if it exists, otherwise just add the above.
// Example of old code to remove:
// import { createBrowserClient } from '@supabase/ssr';
// export const supabase = createBrowserClient<Database>(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
// ); 