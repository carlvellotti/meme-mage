#!/usr/bin/env python3
import os
import sys
import argparse
import logging
import traceback
import uuid
import re
import json # To output results as JSON
import shutil # For enhanced cleanup

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

# --- Environment Variables & API Base URL ---
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
# NODE_API_BASE_URL = os.environ.get("NODE_API_BASE_URL", "http://localhost:3000") # Default to localhost

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    logger.error("FATAL: Missing Supabase environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).")
    sys.exit(1)

# ---

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
    logger.warning(f"Could not extract standard Instagram ID from {url}. Generating UUID.")
    return str(uuid.uuid4())

def cleanup_files(*file_paths):
    """Safely remove temporary files and directories created during processing."""
    logger.info(f"Cleaning up individual files: {file_paths}")
    for file_path in file_paths:
        if file_path and isinstance(file_path, str) and os.path.exists(file_path):
            try:
                # Re-enable file removal
                os.remove(file_path)
                logger.info(f"Removed temporary file: {file_path}")
            except OSError as e:
                logger.error(f"Error removing file {file_path}: {e}")

    # Clean up potential directories
    dirs_to_remove = ['./captions', './frames/debug'] # Relative to script execution dir
    logger.info(f"Cleaning up directories: {dirs_to_remove}")
    for dir_path in dirs_to_remove:
        if os.path.isdir(dir_path):
            try:
                shutil.rmtree(dir_path)
                logger.info(f"Removed temporary directory: {dir_path}")
            except OSError as e:
                logger.error(f"Error removing directory {dir_path}: {e}")
        else:
            logger.info(f"Directory not found, skipping cleanup: {dir_path}")

def process_url(url, uploader):
    """Process a single Instagram URL, upload video, and print results as JSON."""
    video_path = None
    frame_path = None
    cropped_video_path = None
    try:
        # Extract Instagram ID for unique naming
        instagram_id = extract_instagram_id(url)
        if not instagram_id:
            logger.error(f"Could not extract Instagram ID from URL: {url}")
            return False

        logger.info(f"Processing URL: {url} with Instagram ID: {instagram_id}")

        # 1. Download the video
        # (The existing download logic - assume returns path or None)
        video_path = download_video(url)
        if not video_path:
            logger.error("Failed to download video")
            print(json.dumps({"success": False, "error": "Failed to download video", "originalUrl": url}))
            return False

        # 2. Extract a frame
        # (The existing frame extraction logic - assume returns path or None)
        frame_path = extract_frame(video_path)
        if not frame_path:
            logger.error("Failed to extract frame")
            print(json.dumps({"success": False, "error": "Failed to extract frame", "originalUrl": url}))
            return False

        # 3. Crop the video
        # (The existing cropping logic - assume returns path or None)
        cropped_video_path = crop_video(video_path, frame_path)
        if not cropped_video_path:
            logger.error("Failed to crop video")
            print(json.dumps({"success": False, "error": "Failed to crop video", "originalUrl": url}))
            return False

        # 4. Extract caption
        # (The existing caption extraction logic - assume returns text or None)
        caption_text = extract_caption(frame_path)
        logger.info(f"Extracted caption (or placeholder): {caption_text[:100]}...")

        # 5. Upload Cropped Video to Supabase Storage
        # Upload cropped video
        logger.info(f"Attempting to upload video from: {cropped_video_path}")
        video_success, video_url = uploader.upload_video(cropped_video_path, instagram_id)
        if not video_success:
            logger.error(f"Failed to upload video: {video_url}")
            print(json.dumps({"success": False, "error": f"Failed to upload video: {video_url}", "originalUrl": url}))
            return False
        logger.info(f"Video uploaded successfully: {video_url}")

        # 6. Print results as JSON to stdout
        result = {
            "success": True,
            "finalVideoUrl": video_url,
            "captionText": caption_text,
            "instagramId": instagram_id,
            "originalUrl": url
        }
        print(json.dumps(result))
        return True

    except Exception as e:
        error_details = traceback.format_exc()
        logger.error(f"Error processing {url}: {e}\n{error_details}")
        # Print failure JSON on general exception
        print(json.dumps({"success": False, "error": f"General processing error: {str(e)}", "originalUrl": url}))
        return False

    finally:
        # 10. Enhanced Clean up temporary files and directories
        logger.info("Executing finally block for cleanup...")
        cleanup_files(video_path, frame_path, cropped_video_path)

def main():
    """Main entry point: Parses args, initializes uploader, processes URLs."""
    urls = sys.argv[1:]
    if not urls:
        logger.error("Usage: python process_reels.py <url1> [url2] ...")
        sys.exit(1)

    logger.info(f"Received {len(urls)} URLs to process.")

    # Initialize StorageUploader once
    try:
        uploader = StorageUploader()
        logger.info("StorageUploader initialized successfully in main.")
    except ValueError as e:
        logger.error(f"FATAL: Failed to initialize StorageUploader: {e}")
        logger.error("Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY env vars are set.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"FATAL: Unexpected error initializing StorageUploader: {e}")
        sys.exit(1)

    successful_count = 0
    failed_count = 0

    for url in urls:
        url = url.strip()
        if not url:
            continue
        
        if process_url(url, uploader): # Pass uploader instance
            successful_count += 1
        else:
            failed_count += 1

    logger.info("\n--- Processing Summary ---")
    logger.info(f"Successfully processed: {successful_count}")
    logger.info(f"Failed to process:    {failed_count}")
    logger.info("-------------------------")

    if failed_count > 0:
        sys.exit(1) # Exit with error code if any URL failed
    else:
        sys.exit(0)

if __name__ == "__main__":
    main() 