import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { nameToSlug } from '@/lib/utils/slugUtils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    
    // Fetch all templates
    const { data: templates, error } = await supabase
      .from('meme_templates')
      .select('*');

    if (error) throw error;
    
    // Find the template with a matching slug
    const template = templates.find(
      (template) => nameToSlug(template.name) === slug
    );
    
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(template);
  } catch (error) {
    console.error('Error fetching template by slug:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
} 