import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic'; // Disable static optimization
export const fetchCache = 'force-no-store'; // Disable fetch caching
export const revalidate = 0; // Disable revalidation

export async function GET() {
  try {
    console.log('Fetching templates from database...');
    const { data: templates, error } = await supabase
      .from('meme_templates')
      .select('*');

    if (error) throw error;

    // Return response with cache control headers
    return NextResponse.json(templates, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
} 