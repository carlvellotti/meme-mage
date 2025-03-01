import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { instructions } = await request.json();
    const { id } = params;
    
    console.log('Updating template instructions:', { id, instructions });
    
    // Update the template instructions in the database
    const { data, error } = await supabaseAdmin
      .from('meme_templates')
      .update({ instructions })
      .eq('id', id)
      .select()
      .single();
      
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating template instructions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update instructions' },
      { status: 500 }
    );
  }
} 