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
# We'll use import statements that assume these functions are available
try:
    from downloader import download_video
    from frame_extractor import extract_frame
    from video_cropper import crop_video
    from caption_extractor import extract_caption
except ImportError as e:
    print(f"Error importing required modules: {e}")
    print("Make sure all required scripts are in the current directory.")
    sys.exit(1)

# Import our new modules
from storage_uploader import StorageUploader

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('process_reels')

def read_urls_from_file(file_path):
    """
    Read URLs from a text file (one URL per line)
    
    Args:
        file_path (str): Path to the text file containing URLs
        
    Returns:
        list: List of URLs
    """
    logger.info(f"Reading URLs from file: {file_path}")
    urls = []
    try:
        with open(file_path, 'r') as f:
            for line in f:
                url = line.strip()
                if url:  # Skip empty lines
                    urls.append(url)
        logger.info(f"Read {len(urls)} URLs from file")
        return urls
    except Exception as e:
        logger.error(f"Error reading URL file {file_path}: {e}")
        sys.exit(1)

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
    # Fallback: Generate a UUID if no standard ID is found (less ideal but prevents errors)
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
                # print(f"Skipping removal of {file_path} for debugging.")
                # pass # Do nothing
            except OSError as e:
                print(f"Error removing file {file_path}: {e}")
        # else:
            # print(f"Skipping cleanup for non-existent or invalid path: {file_path}")

def process_url(url):
    """Process a single Instagram URL"""
    template_id = None # Initialize template_id
    try:
        # Extract Instagram ID for unique naming
        instagram_id = extract_instagram_id(url)
        if not instagram_id:
            logger.error(f"Could not extract Instagram ID from URL: {url}")
            return False

        # Insert the initial record
        template_id = insert_pending_reel(url)
        if not template_id:
            logger.error(f"Failed to insert initial record for URL: {url}")
            return False

        # Update status to processing
        update_template_status(template_id, 'processing')

        print(f"Processing URL: {url} with ID: {instagram_id}")

        # 1. Download the video
        # (The existing download logic - assume returns path or None)
        video_path = download_video(url) 
        if not video_path:
            update_template_error(template_id, "Failed to download video")
            return False

        # 2. Extract a frame
        # (The existing frame extraction logic - assume returns path or None)
        frame_path = extract_frame(video_path)
        if not frame_path:
            update_template_error(template_id, "Failed to extract frame")
            cleanup_files(video_path) # Clean up downloaded video if frame extraction fails
            return False

        # 3. Crop the video
        # (The existing cropping logic - assume returns path or None)
        cropped_video_path = crop_video(video_path, frame_path)
        if not cropped_video_path:
            update_template_error(template_id, "Failed to crop video")
            cleanup_files(video_path, frame_path) # Clean up original video and frame
            return False

        # 4. Extract caption
        # (The existing caption extraction logic - assume returns text or None)
        caption_text = extract_caption(frame_path)

        # 5. Upload files to Supabase Storage
        # Instantiate StorageUploader here
        try:
            uploader = StorageUploader()
            print("StorageUploader initialized successfully.")
        except ValueError as e:
            print(f"Failed to initialize StorageUploader: {e}")
            update_template_error(template_id, f"Storage Uploader init failed: {e}")
            cleanup_files(video_path, frame_path, cropped_video_path)
            return False

        # Upload thumbnail
        print(f"Attempting to upload thumbnail from: {frame_path}")
        thumbnail_success, thumbnail_url = uploader.upload_thumbnail(frame_path, instagram_id)
        if not thumbnail_success:
            update_template_error(template_id, f"Failed to upload thumbnail: {thumbnail_url}")
            cleanup_files(video_path, frame_path, cropped_video_path)
            return False
        print(f"Thumbnail uploaded: {thumbnail_url}")

        # Upload cropped video
        print(f"Attempting to upload video from: {cropped_video_path}")
        video_success, video_url = uploader.upload_video(cropped_video_path, instagram_id)
        if not video_success:
            update_template_error(template_id, f"Failed to upload video: {video_url}")
            # Attempt to clean up thumbnail if video upload fails?
            # Consider adding cleanup logic for already uploaded thumbnail
            cleanup_files(video_path, frame_path, cropped_video_path)
            return False
        print(f"Video uploaded: {video_url}")

        # 6. Update the database record with the URLs and caption
        print("Attempting to update database record...")
        update_success = update_template_urls(
            template_id,
            cropped_video_url=video_url,
            thumbnail_url=thumbnail_url,
            caption_text=caption_text,
            status='completed'
        )
        if not update_success:
            # Log error, but maybe don't fail the whole process?
            # The files are uploaded, just the DB record is wrong.
            print(f"⚠️ Failed to update database record for {template_id}, but files were uploaded.")
            # Optionally: try setting status to 'completed_upload_db_error'?
        else:
            print(f"Database record updated successfully for {template_id}")


        print(f"Successfully processed {url}")

        # 7. Clean up temporary files
        cleanup_files(video_path, frame_path, cropped_video_path)

        return True

    except Exception as e:
        error_details = traceback.format_exc()
        print(f"Error processing {url}: {e}\n{error_details}")

        # Update the status if we have a template ID
        if template_id:
            update_template_error(template_id, f"Processing error: {str(e)}")

        # Ensure cleanup happens even on unexpected errors
        # Need to define paths before cleanup is called
        # This part needs careful handling of variable scope if error occurs early
        # cleanup_files(video_path, frame_path, cropped_video_path) # Be careful here

        return False

def main():
    """Main entry point: Parses args, initializes uploader, processes URLs."""
    urls = sys.argv[1:]
    if not urls:
        print("Usage: python process_reels.py <url1> [url2] ...")
        sys.exit(1)

    print(f"Received {len(urls)} URLs to process.")

    # Initialize StorageUploader once
    try:
        uploader = StorageUploader()
    except ValueError as e:
        print(f"FATAL: Failed to initialize StorageUploader: {e}")
        print("Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY env vars are set.")
        sys.exit(1)
    except Exception as e:
         print(f"FATAL: Unexpected error initializing StorageUploader: {e}")
         sys.exit(1)

    # Ensure necessary DB env var is set before processing
    if not os.environ.get("SUPABASE_DB_URL"):
         print("FATAL: SUPABASE_DB_URL environment variable not set.")
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