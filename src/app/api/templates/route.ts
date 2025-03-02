import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    // Get the URL object from the request
    const url = new URL(request.url);
    
    // Pull query parameters if needed, like a timestamp for cache busting
    const timestamp = url.searchParams.get('t');
    
    // Log the request timestamp for debugging
    if (timestamp) {
      console.log('Templates fetch requested with timestamp:', timestamp);
    }
    
    const { data: templates, error } = await supabase
      .from('meme_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Add headers to prevent caching
    const response = NextResponse.json(templates);
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
} 