import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { spawn } from 'child_process'; // Import if using direct FFmpeg execution
import { promises as fs } from 'fs';        // Import for filesystem operations
import path from 'path';                 // Import for path manipulation
import os from 'os';                   // Import for tmpdir()

interface CropPayload {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Helper function to validate crop payload
function isValidCropPayload(payload: any): payload is CropPayload {
  return (
    payload &&
    typeof payload.x === 'number' &&
    typeof payload.y === 'number' &&
    typeof payload.width === 'number' && payload.width > 0 &&
    typeof payload.height === 'number' && payload.height > 0
  );
}

// Helper function to extract bucket name and path from Supabase storage URL
function getStoragePathFromUrl(url: string): { bucket: string; encodedPath: string } | null {
  try {
    const urlObj = new URL(url);
    const pathPrefix = '/storage/v1/object/public/';
    const pathname = urlObj.pathname; // May or may not be decoded depending on input/Node version

    if (!pathname.startsWith(pathPrefix)) {
         console.error('[getStoragePathFromUrl] URL path does not match expected Supabase public object prefix:', pathname);
         return null;
    }

    // Find bucket name using the potentially decoded pathname
    const bucketAndMaybeDecodedPath = pathname.substring(pathPrefix.length);
    const firstSlashIndex = bucketAndMaybeDecodedPath.indexOf('/');
    if (firstSlashIndex === -1) {
        console.error('[getStoragePathFromUrl] Could not separate bucket and path:', bucketAndMaybeDecodedPath);
        return null;
    }
    const bucket = bucketAndMaybeDecodedPath.substring(0, firstSlashIndex);
    
    // Construct the marker string to find in the *original* URL
    const pathMarker = `/storage/v1/object/public/${bucket}/`;
    // Use the original URL href, which preserves encoding
    const originalHref = urlObj.href;
    const pathStartIndex = originalHref.indexOf(pathMarker);
    if (pathStartIndex === -1) {
        console.error('[getStoragePathFromUrl] Could not find path marker in original URL href:', originalHref);
        // Fallback attempt using pathname just in case href differs significantly (less likely)
        const pathStartIndexFallback = url.indexOf(pathMarker);
        if (pathStartIndexFallback === -1) {
            console.error('[getStoragePathFromUrl] Could not find path marker in original URL string either:', url);
            return null;
        }
         console.warn('[getStoragePathFromUrl] Using fallback path search in original string.');
         const encodedPath = url.substring(pathStartIndexFallback + pathMarker.length);
         console.log(`[getStoragePathFromUrl] Extracted Bucket: ${bucket}, Encoded Path (from fallback): ${encodedPath}`);
         return { bucket, encodedPath };
    }
    
    // The actual path (key) starts after the marker in the original href
    const encodedPath = originalHref.substring(pathStartIndex + pathMarker.length);
    
    console.log(`[getStoragePathFromUrl] Extracted Bucket: ${bucket}, Encoded Path (from href): ${encodedPath}`);
    return { bucket, encodedPath }; // Use the preserved encoded path

  } catch (e) {
    console.error("[getStoragePathFromUrl] Failed to parse Supabase URL:", e);
    return null;
  }
}

// --- FFprobe Helper ---
interface VideoDimensions {
  width: number;
  height: number;
}

async function getVideoDimensions(filePath: string): Promise<VideoDimensions> {
  // Use 'ffprobe' command directly, assuming it's in PATH
  const ffprobeCommand = 'ffprobe';
  const args = [
    '-v', 'error',             // Only show errors
    '-select_streams', 'v:0',  // Select the first video stream
    '-show_entries', 'stream=width,height', // Request width and height
    '-of', 'json',             // Output in JSON format
    filePath,
  ];

  console.log(`[getVideoDimensions] Executing: ${ffprobeCommand} ${args.join(' ')}`);

  return new Promise((resolve, reject) => {
    const process = spawn(ffprobeCommand, args);
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('error', (err) => {
      console.error('[ffprobe ERROR]: Failed to start ffprobe process.', err);
       if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error(`Failed to start ffprobe: Command not found. Make sure FFmpeg (which includes ffprobe) is installed and in your system PATH.`));
      } else {
        reject(new Error(`Failed to start ffprobe: ${err.message}`));
      }
    });

    process.on('close', (code) => {
      console.log(`[ffprobe CLOSE]: Process exited with code ${code}`);
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          if (result.streams && result.streams.length > 0) {
            const stream = result.streams[0];
            if (stream.width && stream.height) {
              console.log(`[getVideoDimensions] Found dimensions: ${stream.width}x${stream.height}`);
              resolve({ width: stream.width, height: stream.height });
              return;
            }
          }
          reject(new Error('ffprobe output did not contain expected stream dimensions.'));
        } catch (e) {
          reject(new Error(`Failed to parse ffprobe JSON output: ${e}. Output: ${stdout}`));
        }
      } else {
        reject(new Error(`ffprobe exited with code ${code}. Stderr: ${stderr}`));
      }
    });
  });
}
// --- End FFprobe Helper ---

// --- FFmpeg Execution Helper ---
async function runFFmpegCrop(
  inputPath: string,
  outputPath: string,
  crop: CropPayload
): Promise<void> {
  // Use 'ffmpeg' command directly. Assumes it's in PATH locally (e.g., via Homebrew)
  // and relies on the bundled binary being found/used in deployment (or adjust path there)
  const ffmpegCommand = 'ffmpeg'; 
  // const ffmpegPath = path.join(process.cwd(), 'bin', 'ffmpeg'); // Keep this line commented/removed for now

  const args = [
    '-i', inputPath,
    '-vf', `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`,
    '-c:a', 'copy',
    '-y',
    outputPath,
  ];

  console.log(`[runFFmpegCrop] Executing: ${ffmpegCommand} ${args.join(' ')}`);

  // Remove the check for the bundled binary path for local execution
  // try {
  //   await fs.access(ffmpegPath, fs.constants.X_OK);
  //   console.log(`[runFFmpegCrop] Found FFmpeg binary at: ${ffmpegPath}`);
  // } catch (err) {
  //   console.error(`[runFFmpegCrop] Error accessing FFmpeg binary at ${ffmpegPath}:`, err);
  //   throw new Error(`FFmpeg binary not found or not executable at ${ffmpegPath}. Ensure it's included in the deployment and has execute permissions.`);
  // }

  return new Promise((resolve, reject) => {
    const process = spawn(ffmpegCommand, args);

    let stderrOutput = '';

    process.stdout.on('data', (data) => {
      console.log(`[FFmpeg STDOUT]: ${data}`);
    });

    process.stderr.on('data', (data) => {
      const line = data.toString();
      console.error(`[FFmpeg STDERR]: ${line}`);
      stderrOutput += line;
    });

    process.on('error', (err) => {
      console.error('[FFmpeg ERROR]: Failed to start FFmpeg process.', err);
      // Check if the error is ENOENT (Executable Not Found)
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error(`Failed to start FFmpeg: Command not found. Make sure FFmpeg is installed and in your system PATH (e.g., via 'brew install ffmpeg').`));
      } else {
        reject(new Error(`Failed to start FFmpeg: ${err.message}`));
      }
    });

    process.on('close', (code) => {
      console.log(`[FFmpeg CLOSE]: Process exited with code ${code}`);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}. Stderr: ${stderrOutput}`));
      }
    });
  });
}
// --- End FFmpeg Execution Helper ---

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const templateId = params.id;

  if (!templateId) {
    return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
  }

  let payload: CropPayload;
  try {
    payload = await req.json();
    if (!isValidCropPayload(payload)) {
      throw new Error('Invalid crop parameters. Required fields: x, y, width, height (all numbers, width/height > 0)');
    }
  } catch (error: any) {
    console.error(`[API /templates/${templateId}/crop] Invalid request body:`, error);
    return NextResponse.json({ error: error.message || 'Invalid request body' }, { status: 400 });
  }

  console.log(`[API /templates/${templateId}/crop] Received crop request with payload:`, payload);

  // --- TODO: Implement Authentication/Authorization Check ---
  // Ensure the user making the request has permission to edit this template

  // Define temporary file paths
  const tempDir = os.tmpdir();
  const uniqueFilenameBase = `template_${templateId}_${Date.now()}`;
  const inputPath = path.join(tempDir, `${uniqueFilenameBase}_input.mp4`);
  const outputPath = path.join(tempDir, `${uniqueFilenameBase}_output.mp4`);
  let storageDetails: { bucket: string; encodedPath: string } | null = null;

  try {
    // 1. Fetch Template Data
    console.log(`[API /templates/${templateId}/crop] Fetching template data...`);
    const { data: template, error: fetchError } = await supabaseAdmin
      .from('meme_templates')
      .select('video_url')
      .eq('id', templateId)
      .single();

    if (fetchError || !template) {
      console.error(`[API /templates/${templateId}/crop] Error fetching template:`, fetchError);
      return NextResponse.json({ error: fetchError?.message || 'Template not found' }, { status: 404 });
    }
    if (!template.video_url) {
      return NextResponse.json({ error: 'Template does not have a video URL to crop' }, { status: 400 });
    }

    const originalVideoUrl = template.video_url;
    console.log(`[API /templates/${templateId}/crop] Original video URL: ${originalVideoUrl}`);

    // Extract bucket and ENCODED path from URL
    storageDetails = getStoragePathFromUrl(originalVideoUrl);
    if (!storageDetails) {
      throw new Error('Could not determine storage path from video URL');
    }
    // Log the encoded path
    console.log(`[API /templates/${templateId}/crop] Storage details - Bucket: ${storageDetails.bucket}, Encoded Path: ${storageDetails.encodedPath}`);


    // 2. Download Video from Supabase Storage using ENCODED path
    console.log(`[API /templates/${templateId}/crop] Downloading video using encoded path: ${storageDetails.encodedPath}`);
    const { data: downloadData, error: downloadError } = await supabaseAdmin.storage
      .from(storageDetails.bucket)
      .download(storageDetails.encodedPath); // Use encodedPath

    if (downloadError || !downloadData) {
      console.error(`[API /templates/${templateId}/crop] Error downloading video:`, downloadError);
      throw new Error(downloadError?.message || 'Failed to download video from storage');
    }

    // Convert Blob to Uint8Array and write to temporary file
    const videoArrayBuffer = await downloadData.arrayBuffer();
    await fs.writeFile(inputPath, new Uint8Array(videoArrayBuffer)); // Use Uint8Array directly
    console.log(`[API /templates/${templateId}/crop] Video downloaded to ${inputPath}`);

    // --- Get Actual Video Dimensions --- 
    console.log(`[API /templates/${templateId}/crop] Getting actual video dimensions...`);
    const actualDims = await getVideoDimensions(inputPath);
    console.log(`[API /templates/${templateId}/crop] Actual dimensions: ${actualDims.width}x${actualDims.height}`);

    // --- Calculate Final Crop Parameters --- 
    // --- REMOVE THIS WHOLE SECTION ---
    // // Use x, y from payload, but recalculate width/height based on actual dims
    // // For this specific request (crop bottom 30px):
    // // We assume the user *intended* x=0, y=0 and a height reduction
    // // The payload width/height are ignored in this calculation
    // const cropX = payload.x; // Use user-provided X offset
    // const cropY = payload.y; // Use user-provided Y offset
    // const cropAmountBottom = 30; // Specific to this request
    // const finalCropWidth = actualDims.width - cropX;
    // const finalCropHeight = actualDims.height - cropY - cropAmountBottom; // Adjust height based on Y offset and bottom crop
    // 
    // // Validate calculated dimensions
    // if (cropX < 0 || cropY < 0 || finalCropWidth <= 0 || finalCropHeight <= 0) {
    //   throw new Error(`Invalid crop parameters after calculation: x=${cropX}, y=${cropY}, width=${finalCropWidth}, height=${finalCropHeight}. Original dims: ${actualDims.width}x${actualDims.height}`);
    // }
    // if (cropX + finalCropWidth > actualDims.width || cropY + finalCropHeight > actualDims.height) {
    //     throw new Error(`Calculated crop area exceeds video dimensions. Crop: x=${cropX}, y=${cropY}, w=${finalCropWidth}, h=${finalCropHeight}. Video: ${actualDims.width}x${actualDims.height}`);
    // }
    // 
    // const finalCropPayload: CropPayload = {
    //     x: cropX,
    //     y: cropY,
    //     width: finalCropWidth,
    //     height: finalCropHeight
    // };
    // --- END REMOVE SECTION ---

    // --- NEW: Clamp received payload to video bounds --- 
    const final: CropPayload = {
      x: Math.max(0,               Math.min(payload.x,      actualDims.width  - 2)),
      y: Math.max(0,               Math.min(payload.y,      actualDims.height - 2)),
      width:  Math.max(2,
              Math.min(payload.width,  actualDims.width  - payload.x)), // Use payload.x here
      height: Math.max(2,
              Math.min(payload.height, actualDims.height - payload.y)), // Use payload.y here
    };

    // force even numbers so H.264 is happy
    final.width  &= ~1;
    final.height &= ~1;

    console.log(`[API /templates/${templateId}/crop] Clamped final crop payload:`, final);

    // Validate clamped dimensions just in case
    if (final.width <= 0 || final.height <= 0 || 
        final.x + final.width > actualDims.width || 
        final.y + final.height > actualDims.height) {
      console.error('Clamped crop dimensions are invalid:', final, 'against actual:', actualDims);
      throw new Error('Invalid crop parameters after clamping.');
    }

    // 3. Execute FFmpeg Crop using clamped payload
    console.log(`[API /templates/${templateId}/crop] Executing FFmpeg crop...`);
    await runFFmpegCrop(inputPath, outputPath, final); // Use clamped final payload
    console.log(`[API /templates/${templateId}/crop] FFmpeg processing completed successfully.`);

    // Check if output file exists (sanity check)
    try {
        await fs.access(outputPath, fs.constants.R_OK); // Check read permission
    } catch (err) {
        console.error(`[API /templates/${templateId}/crop] Output file not found or readable after FFmpeg: ${outputPath}`, err);
        throw new Error('FFmpeg completed but output file is missing or unreadable.');
    }

    // 4. Upload Cropped Video back to Supabase Storage (DO NOT Overwrite) using ENCODED path
    const parsedPath = path.parse(storageDetails.encodedPath);
    // Decode the filename part ONLY for appending _cropped, keep directory encoded
    const decodedName = decodeURIComponent(parsedPath.name);
    const newName = `${decodedName}_cropped`;
    // Re-encode the modified name part
    const encodedNewName = encodeURIComponent(newName);
    // Construct the new key, keeping the original directory structure (which might also be encoded)
    const newKey = path.join(parsedPath.dir, `${encodedNewName}${parsedPath.ext}`).replace(/\\/g, '/'); // Use path.join and replace backslashes

    console.log(`[API /templates/${templateId}/crop] Uploading cropped video to new key: ${newKey}`);
    const croppedVideoBuffer = await fs.readFile(outputPath);
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(storageDetails.bucket)
      .upload(newKey, croppedVideoBuffer, { // Use NEW key
        upsert: false, // Do not upsert, should be a new file
        contentType: 'video/mp4',
      });

    if (uploadError) {
      console.error(`[API /templates/${templateId}/crop] Error uploading video:`, uploadError);
      throw new Error(uploadError.message || 'Failed to upload cropped video');
    }
    console.log(`[API /templates/${templateId}/crop] Video uploaded successfully. Upload path reported: ${uploadData?.path}`);

    // --- Manually Construct Public URL --- 
    console.log(`[API /templates/${templateId}/crop] Manually constructing public URL for new key...`);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
        const errorMsg = `[API /templates/${templateId}/crop] Error: NEXT_PUBLIC_SUPABASE_URL environment variable is not set.`;
        console.error(errorMsg);
        throw new Error('Server configuration error: Missing Supabase URL.');
    }
    
    // Construct the base URL using the NEW key
    const baseUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${storageDetails.bucket}/${newKey}`;
    // Add cache-busting timestamp
    const cacheBuster = `?t=${Date.now()}`;
    const newVideoUrl = `${baseUrl}${cacheBuster}`;
    console.log(`[API /templates/${templateId}/crop] Manually constructed public URL for new cropped video: ${newVideoUrl}`);
    
    // 5. Update Database Record
    console.log(`[API /templates/${templateId}/crop] Updating database record with URL: ${newVideoUrl}`);
    const { error: updateError } = await supabaseAdmin
      .from('meme_templates')
      .update({ video_url: newVideoUrl })
      .eq('id', templateId);

    if (updateError) {
      console.error(`[API /templates/${templateId}/crop] Error updating database record:`, updateError);
      throw new Error(updateError.message || 'Failed to update template record in database');
    }
    console.log(`[API /templates/${templateId}/crop] Database record updated.`);

    console.log(`[API /templates/${templateId}/crop] Crop operation successful.`);
    return NextResponse.json({ success: true, updatedVideoUrl: newVideoUrl });

  } catch (error: any) {
    console.error(`[API /templates/${templateId}/crop] Processing error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to process video crop' },
      { status: 500 }
    );
  } finally {
    // 6. Cleanup Temporary Files
    console.log(`[API /templates/${templateId}/crop] Cleaning up temporary files...`);
    try {
      await fs.unlink(inputPath);
      console.log(`[API /templates/${templateId}/crop] Deleted temp file: ${inputPath}`);
    } catch (e: any) { /* Ignore errors if file doesn't exist */ }
    try {
      await fs.unlink(outputPath);
      console.log(`[API /templates/${templateId}/crop] Deleted temp file: ${outputPath}`);
    } catch (e: any) { /* Ignore errors if file doesn't exist */ }
  }
} 