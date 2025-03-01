import { supabase } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic'; // Disable static optimization
export const fetchCache = 'force-no-store'; // Disable fetch caching
export const revalidate = 0; // Disable revalidation

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log('Fetching template by ID:', params.id);
    const { data, error } = await supabase
      .from('meme_templates')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch template' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
      }
    );
  }
} 