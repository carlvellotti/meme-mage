#!/usr/bin/env python3
import os
import sys
import argparse
import logging
from db_manager import insert_pending_reel, update_template_urls, update_template_error, update_template_status
import traceback
import uuid
import re

# Import functions from existing modules
try:
    from downloader import download_video
    from frame_extractor import extract_frame
    from video_cropper import crop_video # Or process_video if that's the main entry point
    from caption_extractor import extract_caption
    from storage_uploader import StorageUploader # Ensure this is present
except ImportError as e:
    print(f"Error importing required modules: {e}")
    print("Make sure all required scripts are in the current directory orPYTHONPATH.")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('process_reels')

def extract_instagram_id(url):
    """Extract a unique identifier from various Instagram URL patterns."""
    patterns = [
        r'instagram\.com/(?:p|reel)/([a-zA-Z0-9_-]+)',
        r'instagram\.com/reels/([a-zA-Z0-9_-]+)',
        r'instagr\.am/(?:p|reel)/([a-zA-Z0-9_-]+)'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    print(f"Warning: Could not extract standard Instagram ID from {url}. Generating UUID.")
    return str(uuid.uuid4())

def cleanup_files(*file_paths):
    """Safely remove temporary files created during processing."""
    print(f"Cleaning up files: {file_paths}")
    for file_path in file_paths:
        if file_path and isinstance(file_path, str) and os.path.exists(file_path):
            try:
                # Re-enable file removal
                os.remove(file_path)
                print(f"Removed temporary file: {file_path}")
            except OSError as e:
                print(f"Error removing file {file_path}: {e}")

def process_url(url):
    """Process a single Instagram URL"""
    video_path = None
    frame_path = None
    cropped_video_path = None
    template_id = None

    try:
        instagram_id = extract_instagram_id(url)
        if not instagram_id:
            logger.error(f"Could not extract Instagram ID from URL: {url}")
            return False

        template_id = insert_pending_reel(url)
        if not template_id:
            logger.error(f"Failed to insert initial record for URL: {url}")
            return False
        update_template_status(template_id, 'processing')
        logger.info(f"Processing URL: {url} with DB ID: {template_id} and Insta ID: {instagram_id}")

        # Define temporary file paths (consider using /tmp on Vercel)
        # For now, assume relative paths work if script runs where expected
        # TODO: Adapt paths for Vercel's /tmp directory
        videos_dir = "videos"
        frames_dir = "frames"
        cropped_dir = "cropped"
        os.makedirs(videos_dir, exist_ok=True)
        os.makedirs(frames_dir, exist_ok=True)
        os.makedirs(cropped_dir, exist_ok=True)

        # 1. Download
        video_path = download_video(url, output_dir=videos_dir, video_id=instagram_id)
        if not video_path:
            update_template_error(template_id, "Failed to download video")
            return False

        # 2. Extract frame (e.g., at 1 second)
        frame_path = extract_frame(video_path, output_dir=frames_dir, time_offset=1)
        if not frame_path:
            update_template_error(template_id, "Failed to extract frame")
            cleanup_files(video_path)
            return False

        # 3. Crop video
        cropped_video_path = crop_video(video_path, frame_path, output_dir=cropped_dir)
        if not cropped_video_path:
            # If cropping fails, we might still want to proceed with the original
            # Let's decide if we upload original or mark as error
            # For now, mark as error if crop explicitly fails
            update_template_error(template_id, "Failed to crop video")
            cleanup_files(video_path, frame_path)
            return False
        
        # If crop_video returns None but didn't error (e.g., invalid region), 
        # maybe we proceed with original? Currently, it returns None on failure.
        # Let's assume if cropped_video_path is None, it's an error state.

        # 4. Extract caption
        caption_text = extract_caption(frame_path)

        # 5. Upload files
        try:
            uploader = StorageUploader()
        except ValueError as e:
            logger.error(f"Failed to initialize StorageUploader: {e}")
            update_template_error(template_id, f"Storage Uploader init failed: {e}")
            cleanup_files(video_path, frame_path, cropped_video_path)
            return False

        # Determine which video to upload (cropped or original)
        video_to_upload = cropped_video_path # Prioritize cropped
        if not video_to_upload:
             logger.warning(f"Cropped video path not available for {url}, cannot upload video.")
             update_template_error(template_id, f"Cropping produced no video file")
             cleanup_files(video_path, frame_path)
             return False # Stop if we can't upload a video

        logger.info(f"Uploading thumbnail from: {frame_path}")
        thumbnail_success, thumbnail_url = uploader.upload_thumbnail(frame_path, instagram_id)
        if not thumbnail_success:
            update_template_error(template_id, f"Failed to upload thumbnail: {thumbnail_url}")
            cleanup_files(video_path, frame_path, cropped_video_path)
            return False

        logger.info(f"Uploading video from: {video_to_upload}")
        video_success, video_url = uploader.upload_video(video_to_upload, instagram_id)
        if not video_success:
            update_template_error(template_id, f"Failed to upload video: {video_url}")
            cleanup_files(video_path, frame_path, cropped_video_path)
            # Consider deleting the already uploaded thumbnail? Difficult to manage state.
            return False

        # 6. Update database
        logger.info("Updating database record...")
        update_success = update_template_urls(
            template_id,
            cropped_video_url=video_url,
            thumbnail_url=thumbnail_url,
            caption_text=caption_text,
            status='completed'
        )
        if not update_success:
            logger.error(f"Failed to update database record for {template_id}, but files were uploaded.")
            # Don't return False, as the core processing succeeded
        else:
            logger.info(f"Database record updated successfully for {template_id}")

        logger.info(f"Successfully processed {url}")
        return True

    except Exception as e:
        error_details = traceback.format_exc()
        logger.error(f"Error processing {url}: {e}\n{error_details}")
        if template_id:
            update_template_error(template_id, f"Processing error: {str(e)}")
        return False

    finally:
        # 7. Clean up temporary files regardless of success/failure
        cleanup_files(video_path, frame_path, cropped_video_path)


def main():
    urls = sys.argv[1:]
    if not urls:
        print("Usage: python process_reels.py <url1> [url2] ...")
        sys.exit(1)
    logger.info(f"Received {len(urls)} URLs to process.")

    # Check essential environment variables needed before loop starts
    required_vars = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_DB_URL']
    # Add GOOGLE_APPLICATION_CREDENTIALS or specific Vision API key if needed
    if 'extract_caption' in globals(): # Only check if caption extraction is imported
         required_vars.append('GOOGLE_APPLICATION_CREDENTIALS') # Or your specific Vision key name

    missing_vars = [var for var in required_vars if not os.environ.get(var)]
    # Allow for SUPABASE_SERVICE_ROLE_KEY as alternative to SUPABASE_SERVICE_KEY
    if 'SUPABASE_SERVICE_KEY' in missing_vars and os.environ.get('SUPABASE_SERVICE_ROLE_KEY'):
        missing_vars.remove('SUPABASE_SERVICE_KEY')
        
    if missing_vars:
        logger.error(f"FATAL: Missing required environment variables: {', '.join(missing_vars)}")
        sys.exit(1)

    successful_count = 0
    failed_count = 0

    for url in urls:
        url = url.strip()
        if not url:
            continue
        
        if process_url(url):
            successful_count += 1
        else:
            failed_count += 1

    print("\n--- Processing Summary ---")
    print(f"Successfully processed: {successful_count}")
    print(f"Failed to process:    {failed_count}")
    print("-------------------------")

    if failed_count > 0:
        sys.exit(1) # Exit with error code if any failed
    else:
        sys.exit(0)

if __name__ == "__main__":
    main() 