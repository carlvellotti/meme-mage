import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('background_videos')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ backgroundVideos: data || [] });
  } catch (error: any) {
    console.error('Error fetching background videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch background videos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, video_url, thumbnail_url } = body;

    if (!name || !video_url) {
      return NextResponse.json(
        { error: 'Name and video_url are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('background_videos')
      .insert({
        name,
        video_url,
        thumbnail_url,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ backgroundVideo: data }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating background video:', error);
    return NextResponse.json(
      { error: 'Failed to create background video' },
      { status: 500 }
    );
  }
} 