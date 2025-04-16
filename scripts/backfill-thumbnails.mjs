// scripts/backfill-thumbnails.mjs
// Run this script using: node --env-file=.env.local scripts/backfill-thumbnails.mjs

import { createClient } from '@supabase/supabase-js'
import { exec } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { promisify } from 'util'

// Promisify exec for async/await usage
const execAsync = promisify(exec)

// --- Configuration ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const THUMBNAIL_TIME = '00:00:01.000'
const STORAGE_BUCKET = 'meme-templates' // Ensure this matches your setup
const THUMBNAIL_FOLDER = 'thumbnails'    // Ensure this matches your setup
const BATCH_SIZE = 10; // Process N templates at a time to avoid overwhelming resources
// --- End Configuration ---

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).')
  console.error('Ensure you have a .env.local file in the root directory and run with `node --env-file=.env.local ...`')
  process.exit(1)
}

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

async function generateAndUploadThumbnail(videoUrl, templateId) {
  let tempVideoPath = null
  let tempThumbnailPath = null

  try {
    console.log(`[${templateId}] Downloading video: ${videoUrl}`)
    const videoResponse = await fetch(videoUrl)
    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video (${videoResponse.status}): ${videoResponse.statusText}`)
    }
    const videoBuffer = await videoResponse.arrayBuffer()
    const videoFileName = path.basename(new URL(videoUrl).pathname) || `video_${templateId}`
    tempVideoPath = path.join(os.tmpdir(), `backfill_vid_${Date.now()}_${videoFileName}`)
    await fs.writeFile(tempVideoPath, new Uint8Array(videoBuffer))

    console.log(`[${templateId}] Generating thumbnail with FFmpeg...`)
    // Sanitize the base filename extracted from the video URL
    const baseName = path.parse(videoFileName).name;
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_'); // Replace invalid chars with underscore
    
    const thumbnailFileName = `${sanitizedBaseName}_thumb_${Date.now()}.jpg`
    tempThumbnailPath = path.join(os.tmpdir(), thumbnailFileName)

    const escapedVideoPath = JSON.stringify(tempVideoPath);
    const escapedThumbnailPath = JSON.stringify(tempThumbnailPath);
    
    const ffmpegCommand = `ffmpeg -i ${escapedVideoPath} -ss ${THUMBNAIL_TIME} -vframes 1 -q:v 2 ${escapedThumbnailPath}`
    // console.log(`[${templateId}] Executing: ${ffmpegCommand}`); // Uncomment for debugging FFmpeg command
    
    try {
        const { stderr } = await execAsync(ffmpegCommand);
        if (stderr && !stderr.includes('ffmpeg version') && !stderr.includes('muxing overhead')) {
            console.warn(`[${templateId}] FFmpeg stderr:`, stderr);
        }
        await fs.access(tempThumbnailPath); // Check file exists
    } catch (ffmpegError) {
        console.error(`[${templateId}] FFmpeg failed:`, ffmpegError);
        try {
            const stats = await fs.stat(tempThumbnailPath);
            if (stats.size === 0) throw new Error('Output thumbnail is empty.');
            console.warn(`[${templateId}] FFmpeg error, but non-empty thumbnail exists. Proceeding.`);
        } catch (statError) {
            throw new Error(`FFmpeg execution failed: ${ffmpegError.message || ffmpegError}`);
        }
    }

    console.log(`[${templateId}] Uploading thumbnail to Supabase Storage...`)
    // Use the sanitized filename for the storage path as well
    const storagePath = `${THUMBNAIL_FOLDER}/${thumbnailFileName}`
    const thumbnailFileBuffer = await fs.readFile(tempThumbnailPath)

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, thumbnailFileBuffer, {
        contentType: 'image/jpeg',
        upsert: false, // Don't overwrite in backfill unless necessary
      })

    if (uploadError) {
      console.error(`[${templateId}] Supabase upload error:`, uploadError)
      throw uploadError
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(uploadData.path)

    console.log(`[${templateId}] Successfully generated thumbnail: ${urlData.publicUrl}`)
    return urlData.publicUrl

  } finally {
    // Cleanup
    try {
      if (tempVideoPath) await fs.unlink(tempVideoPath)
      if (tempThumbnailPath) await fs.unlink(tempThumbnailPath)
    } catch (cleanupError) {
      console.warn(`[${templateId}] Warning: Error during cleanup:`, cleanupError)
    }
  }
}

async function backfillThumbnails() {
  console.log('Starting thumbnail backfill process...')
  let processedCount = 0
  let errorCount = 0
  let batchOffset = 0

  while (true) {
    console.log(`Fetching batch of templates (offset: ${batchOffset}, limit: ${BATCH_SIZE})...`)
    const { data: templates, error: fetchError } = await supabaseAdmin
      .from('meme_templates')
      .select('id, video_url')
      .is('poster_url', null) // Select only those without a poster_url
      .range(batchOffset, batchOffset + BATCH_SIZE - 1)

    if (fetchError) {
      console.error('Error fetching templates:', fetchError)
      process.exit(1)
    }

    if (!templates || templates.length === 0) {
      console.log('No more templates found needing thumbnails.')
      break
    }

    console.log(`Found ${templates.length} templates in this batch.`)

    for (const template of templates) {
      if (!template.video_url) {
        console.warn(`[${template.id}] Skipping template, missing video_url.`)
        continue
      }

      try {
        const thumbnailUrl = await generateAndUploadThumbnail(template.video_url, template.id)

        if (thumbnailUrl) {
          const { error: updateError } = await supabaseAdmin
            .from('meme_templates')
            .update({ poster_url: thumbnailUrl })
            .eq('id', template.id)

          if (updateError) {
            console.error(`[${template.id}] Error updating template record:`, updateError)
            errorCount++
          } else {
            console.log(`[${template.id}] Successfully updated database record.`)
            processedCount++
          }
        } else {
          console.error(`[${template.id}] Failed to generate or upload thumbnail, skipping database update.`)
          errorCount++
        }
      } catch (error) {
        console.error(`[${template.id}] Unhandled error processing template:`, error)
        errorCount++
      }
      // Optional: Add a small delay between processing each template if needed
      // await new Promise(resolve => setTimeout(resolve, 100)); 
    }
    
    batchOffset += templates.length; // Move to the next potential batch start

    // Safety break if something goes wrong or if batch size is not reducing
    if (templates.length < BATCH_SIZE) {
        console.log("Processed last batch.")
        break;
    }
  }

  console.log('------------------------------------------')
  console.log('Thumbnail Backfill Summary:')
  console.log(`Successfully processed: ${processedCount}`) 
  console.log(`Encountered errors:   ${errorCount}`)  
  console.log('------------------------------------------')
}

// Run the backfill process
backfillThumbnails().catch((err) => {
  console.error('Critical error during backfill execution:', err)
  process.exit(1)
}) 