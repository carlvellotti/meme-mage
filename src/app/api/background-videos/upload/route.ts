import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('Authentication check:', { 
      user: user ? { id: user.id, email: user.email } : null, 
      authError 
    });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create service role client for database operations (bypasses RLS)
    const { createClient: createServiceClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('video') as File;
    const name = formData.get('name') as string;

    console.log('Upload request:', { 
      fileName: file?.name, 
      fileSize: file?.size, 
      name,
      userId: user.id 
    });

    if (!file || !name) {
      return NextResponse.json(
        { error: 'Video file and name are required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('video/')) {
      return NextResponse.json(
        { error: 'Please upload a video file' },
        { status: 400 }
      );
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Video file must be smaller than 50MB' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalExtension = file.name.split('.').pop() || 'mp4';
    const fileName = `background-video-${timestamp}.${originalExtension}`;
    const filePath = `background-videos/${fileName}`;

    // Upload file to Supabase Storage using the authenticated client
    console.log('Starting storage upload...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('background-videos')  // Back to using the proper background-videos bucket
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    console.log('Storage upload successful, getting public URL...');
    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('background-videos')
      .getPublicUrl(filePath);

    const video_url = urlData.publicUrl;

    console.log('Attempting database insertion:', {
      name: name.trim(),
      video_url,
      userId: user.id
    });

    // Create database record using service role client (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('background_videos')
      .insert({
        name: name.trim(),
        video_url,
        thumbnail_url: null, // Could generate thumbnail later
        is_active: true
      })
      .select()
      .single();

    console.log('Database insertion result:', { data, error });

    if (error) {
      console.error('Database insertion failed:', error);
      // If database insert fails, try to clean up uploaded file
      try {
        await supabase.storage
          .from('background-videos')
          .remove([filePath]);
      } catch (cleanupError) {
        console.error('Failed to cleanup uploaded file:', cleanupError);
      }
      
      return NextResponse.json(
        { error: `Database insertion failed: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ backgroundVideo: data }, { status: 201 });

  } catch (error: any) {
    console.error('Error uploading background video:', error);
    return NextResponse.json(
      { error: 'Failed to upload background video' },
      { status: 500 }
    );
  }
} 