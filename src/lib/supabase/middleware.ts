import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { type NextRequest, type NextResponse } from 'next/server';
import { Database } from './types';

export const createClient = (req: NextRequest, res: NextResponse) => {
  return createMiddlewareClient<Database>({ req, res });
}; 