import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { promisify } from 'util'

// Promisify exec for async/await usage
const execAsync = promisify(exec)

// Initialize Supabase Admin Client (use environment variables)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// Configuration
const THUMBNAIL_TIME = '00:00:01.000' // Extract frame at 1 second
const STORAGE_BUCKET = 'meme-templates' // Or dedicated 'thumbnails' bucket if you prefer
const THUMBNAIL_FOLDER = 'thumbnails' // Subfolder within the bucket

export async function POST(request: Request) {
  let videoUrl: string | null = null
  let tempVideoPath: string | null = null
  let tempThumbnailPath: string | null = null

  try {
    const body = await request.json()
    videoUrl = body.videoUrl

    if (!videoUrl) {
      return NextResponse.json({ error: 'Missing videoUrl in request body' }, { status: 400 })
    }

    console.log(`Received request to generate thumbnail for: ${videoUrl}`)

    // 1. Download Video
    console.log('Downloading video...')
    const videoResponse = await fetch(videoUrl)
    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video: ${videoResponse.statusText}`)
    }
    const videoBuffer = await videoResponse.arrayBuffer()
    const videoFileName = path.basename(new URL(videoUrl).pathname)
    tempVideoPath = path.join(os.tmpdir(), `temp_video_${Date.now()}_${videoFileName}`)
    await fs.writeFile(tempVideoPath, new Uint8Array(videoBuffer))
    console.log(`Video downloaded to: ${tempVideoPath}`)

    // 2. Generate Thumbnail using FFmpeg
    console.log('Generating thumbnail with FFmpeg...')
    const thumbnailFileName = `${path.parse(videoFileName).name}_thumb.jpg`
    tempThumbnailPath = path.join(os.tmpdir(), thumbnailFileName)

    // Ensure tempVideoPath and tempThumbnailPath are properly escaped for the shell command
    const escapedVideoPath = JSON.stringify(tempVideoPath);
    const escapedThumbnailPath = JSON.stringify(tempThumbnailPath);
    
    const ffmpegCommand = `ffmpeg -i ${escapedVideoPath} -ss ${THUMBNAIL_TIME} -vframes 1 -q:v 2 ${escapedThumbnailPath}`
    console.log(`Executing FFmpeg command: ${ffmpegCommand}`)

    try {
        const { stdout, stderr } = await execAsync(ffmpegCommand);
        if (stderr && !stderr.includes('ffmpeg version')) { // Ignore version info often printed to stderr
            console.warn('FFmpeg stderr:', stderr);
            // Decide if stderr content indicates a real error. For now, we proceed if a file is created.
        }
        console.log('FFmpeg stdout:', stdout);
        // Verify thumbnail file exists
        await fs.access(tempThumbnailPath); 
        console.log(`Thumbnail generated at: ${tempThumbnailPath}`)
    } catch (ffmpegError: any) {
        console.error('FFmpeg execution failed:', ffmpegError);
        // Attempt to read stats of the potentially created file to see if it's valid
        try {
            const stats = await fs.stat(tempThumbnailPath);
            if (stats.size === 0) {
                throw new Error('FFmpeg failed: Output thumbnail is empty.');
            }
            // If file exists and is not empty, maybe it was a warning in stderr? Proceed with caution.
            console.warn("FFmpeg reported an error, but a non-empty thumbnail file exists. Proceeding with upload.");
        } catch (statError) {
             // If stat fails (file doesn't exist or is inaccessible), rethrow the original error
            throw new Error(`FFmpeg execution failed: ${ffmpegError.message || ffmpegError}`);
        }
    }


    // 3. Upload Thumbnail to Supabase Storage
    console.log('Uploading thumbnail to Supabase Storage...')
    const storagePath = `${THUMBNAIL_FOLDER}/${thumbnailFileName}`
    const thumbnailFileBuffer = await fs.readFile(tempThumbnailPath)

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, thumbnailFileBuffer, {
        contentType: 'image/jpeg',
        upsert: true, // Overwrite if exists
      })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      throw uploadError
    }
    console.log(`Thumbnail uploaded to path: ${uploadData.path}`)

    // 4. Get Public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(uploadData.path)

    const publicUrl = urlData.publicUrl
    console.log(`Public thumbnail URL: ${publicUrl}`)

    // Cleanup is handled in the finally block

    return NextResponse.json({ thumbnailUrl: publicUrl })

  } catch (error) {
    console.error('Thumbnail generation failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json({ error: `Thumbnail generation failed: ${errorMessage}` }, { status: 500 })

  } finally {
    // 5. Cleanup Temporary Files
    try {
      if (tempVideoPath) {
        await fs.unlink(tempVideoPath)
        console.log(`Deleted temporary video: ${tempVideoPath}`)
      }
      if (tempThumbnailPath) {
        await fs.unlink(tempThumbnailPath)
        console.log(`Deleted temporary thumbnail: ${tempThumbnailPath}`)
      }
    } catch (cleanupError) {
      console.error('Error during temporary file cleanup:', cleanupError)
    }
  }
}

// Add Edge runtime configuration if needed, but exec likely requires Node.js runtime
// export const runtime = 'edge' // Check if compatible with child_process and fs 