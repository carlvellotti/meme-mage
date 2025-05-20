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
    # Output error as JSON for Node.js to potentially catch
    print(json.dumps({"success": False, "error": f"Python script import error: {e}", "originalUrl": sys.argv[1] if len(sys.argv) > 1 else "unknown"}))
    sys.exit(1)

# Import our new modules
try:
    from storage_uploader import StorageUploader
except ImportError as e:
    print(json.dumps({"success": False, "error": f"Python script import error (StorageUploader): {e}", "originalUrl": sys.argv[1] if len(sys.argv) > 1 else "unknown"}))
    sys.exit(1)

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
    # This error will be logged, but Node.js will primarily see the JSON output (if any) or stderr.
    logger.error("FATAL: Missing Supabase environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).")
    # Output error as JSON for Node.js to catch if this specific check fails early.
    # The originalUrl might not be available yet if sys.argv is not parsed.
    print(json.dumps({"success": False, "error": "Python script environment error: Missing Supabase credentials.", "originalUrl": sys.argv[1] if len(sys.argv) > 1 else "unknown_url_at_env_check"}))
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

def process_url(url, uploader, is_greenscreen=False):
    """Process a single Instagram URL, upload video, and print results as JSON."""
    video_path = None
    frame_path = None
    cropped_video_path = None
    # Ensure originalUrl is part of the error response if url is available
    error_response_base = {"success": False, "originalUrl": url}

    try:
        # Extract Instagram ID for unique naming
        # For TikTok or other URLs in greenscreen mode, this might need adjustment or a different ID strategy
        # For now, it will try to extract or generate UUID
        instagram_id = extract_instagram_id(url) 
        if not instagram_id:
            logger.error(f"Could not extract a usable ID from URL: {url}")
            error_response_base.update({"error": "Could not extract usable ID"})
            print(json.dumps(error_response_base))
            return False

        logger.info(f"Processing URL: {url} with ID: {instagram_id}, Greenscreen Mode: {is_greenscreen}")

        # 1. Download the video
        video_path = download_video(url)
        if not video_path:
            logger.error(f"Failed to download video for {url}")
            error_response_base.update({"error": "Failed to download video"})
            print(json.dumps(error_response_base))
            return False

        video_to_upload = video_path # Default to original downloaded video
        caption_text = None # Default caption to None

        if not is_greenscreen:
            logger.info(f"Non-greenscreen mode for {url}. Proceeding with frame extraction, cropping, and caption extraction.")
            # 2. Extract a frame (only if not greenscreen)
            frame_path = extract_frame(video_path)
            if not frame_path:
                logger.error(f"Failed to extract frame for {url}")
                error_response_base.update({"error": "Failed to extract frame"})
                print(json.dumps(error_response_base))
                return False

            # 3. Crop the video (only if not greenscreen)
            cropped_video_path = crop_video(video_path, frame_path)
            if not cropped_video_path:
                logger.error(f"Failed to crop video for {url}")
                error_response_base.update({"error": "Failed to crop video"})
                print(json.dumps(error_response_base))
                return False
            video_to_upload = cropped_video_path # For non-greenscreen, upload the cropped version

            # 4. Extract caption (only if not greenscreen)
            caption_text = extract_caption(frame_path)
            logger.info(f"Extracted caption (or placeholder) for {url}: {caption_text[:100] if caption_text else 'None'}...")
        else:
            logger.info(f"Greenscreen mode for {url}. Skipping frame extraction, cropping, and caption extraction.")
            # caption_text remains None as initialized
            # video_to_upload remains video_path (original download) as initialized

        # 5. Upload Video to Supabase Storage
        logger.info(f"Attempting to upload video from: {video_to_upload} for {url}")
        video_success, video_storage_url_or_error = uploader.upload_video(video_to_upload, instagram_id)
        if not video_success:
            logger.error(f"Failed to upload video for {url}: {video_storage_url_or_error}")
            error_response_base.update({"error": f"Failed to upload video: {video_storage_url_or_error}"})
            print(json.dumps(error_response_base))
            return False
        logger.info(f"Video uploaded successfully for {url}: {video_storage_url_or_error}")

        # 6. Print results as JSON to stdout
        result = {
            "success": True,
            "finalVideoUrl": video_storage_url_or_error,
            "captionText": caption_text, # Will be None for greenscreen mode
            "instagramId": instagram_id, # Or a more generic ID for TikTok etc.
            "originalUrl": url
        }
        print(json.dumps(result))
        return True

    except Exception as e:
        error_details = traceback.format_exc()
        logger.error(f"Error processing {url}: {e}\n{error_details}")
        error_response_base.update({"error": f"General processing error for {url}: {str(e)}"})
        print(json.dumps(error_response_base))
        return False

    finally:
        logger.info(f"Executing finally block for cleanup for URL: {url}...")
        cleanup_files(video_path, frame_path, cropped_video_path)

def main():
    """Main entry point: Expects a single URL, initializes uploader, processes it."""
    
    parser = argparse.ArgumentParser(description="Process a single video URL (e.g., Instagram Reel, TikTok).")
    parser.add_argument("url", help="The URL of the video to process.")
    parser.add_argument("--is-greenscreen", action="store_true", help="Flag to indicate greenscreen mode (skips cropping and caption extraction).")
    
    args = parser.parse_args()

    target_url = args.url.strip()
    is_greenscreen_mode = args.is_greenscreen

    if not target_url:
        logger.error("Received an empty URL.")
        print(json.dumps({"success": False, "error": "Python script error: Received an empty URL.", "originalUrl": target_url}))
        sys.exit(1)
        
    logger.info(f"Python script starting processing for single URL: {target_url}, Greenscreen: {is_greenscreen_mode}")

    # Initialize StorageUploader once
    try:
        uploader = StorageUploader()
        logger.info("StorageUploader initialized successfully.")
    except ValueError as e: # Specific error for missing env vars in StorageUploader
        logger.error(f"FATAL: Failed to initialize StorageUploader: {e}")
        print(json.dumps({"success": False, "error": f"Python StorageUploader init error: {e}", "originalUrl": target_url}))
        sys.exit(1)
    except Exception as e: # Catch any other init errors
        logger.error(f"FATAL: Unexpected error initializing StorageUploader: {e}")
        print(json.dumps({"success": False, "error": f"Python StorageUploader unexpected init error: {e}", "originalUrl": target_url}))
        sys.exit(1)

    # Process the single URL
    # The process_url function already prints the JSON output and returns True/False
    if process_url(target_url, uploader, is_greenscreen_mode):
        logger.info(f"Successfully processed URL: {target_url}")
        sys.exit(0) # Success
    else:
        logger.error(f"Failed to process URL: {target_url}")
        sys.exit(1) # Failure (JSON error already printed by process_url)

if __name__ == "__main__":
    main() 