#!/usr/bin/env python3
import os
import sys
import argparse
import logging
from db_manager import DatabaseManager

# Import functions from existing modules
try:
    from frame_extractor import extract_frame
    from video_cropper import crop_video
    from caption_extractor import extract_caption
except ImportError as e:
    print(f"Error importing required modules: {e}")
    print("Make sure all required scripts are in the current directory.")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('test_process')

def process_existing_video(video_path, output_dirs):
    """
    Process an existing video file through the entire pipeline
    
    Args:
        video_path (str): Path to the video file
        output_dirs (dict): Dictionary with output directories
        
    Returns:
        dict: Processing results with paths and caption
    """
    video_id = os.path.splitext(os.path.basename(video_path))[0]
    result = {'video_id': video_id, 'success': False}
    
    try:
        logger.info(f"Processing video: {video_path}")
        
        # Step 1: Extract a frame
        frame_path = extract_frame(video_path, output_dir=output_dirs['frames'])
        if not frame_path or not os.path.exists(frame_path):
            logger.error(f"Failed to extract frame from {video_path}")
            return result
        
        logger.info(f"Extracted frame: {frame_path}")
        
        # Step 2: Crop the video
        cropped_path = crop_video(video_path, frame_path, output_dir=output_dirs['cropped'])
        if not cropped_path or not os.path.exists(cropped_path):
            logger.error(f"Failed to crop video {video_path}")
            return result
        
        logger.info(f"Cropped video: {cropped_path}")
        
        # Step 3: Extract caption
        caption_text = extract_caption(frame_path, output_dir=output_dirs['captions'])
        if not caption_text:
            logger.warning(f"No caption extracted from {frame_path}")
            caption_text = ""
        
        logger.info(f"Extracted caption: {caption_text}")
        
        # Update result
        result['video_path'] = cropped_path
        result['caption_text'] = caption_text
        result['success'] = True
        
        return result
    
    except Exception as e:
        logger.error(f"Error processing {video_path}: {e}")
        return result

def store_result_in_db(result):
    """
    Store processing result in the database
    
    Args:
        result (dict): Processing result
        
    Returns:
        bool: True if stored successfully, False otherwise
    """
    if not result['success']:
        return False
    
    # Initialize the database
    DatabaseManager.initialize()
    
    try:
        # Store in database
        url = f"https://www.instagram.com/reel/{result['video_id']}/"
        caption_text = result['caption_text']
        video_path = result['video_path']
        
        # Make sure video_path is absolute
        if not os.path.isabs(video_path):
            video_path = os.path.abspath(video_path)
        
        DatabaseManager.store_reel(url, caption_text, video_path)
        logger.info(f"Stored reel in database: {result['video_id']}")
        
        # Close database connections
        DatabaseManager.close_all_connections()
        return True
    except Exception as e:
        logger.error(f"Failed to store result in database: {e}")
        DatabaseManager.close_all_connections()
        return False

def main():
    parser = argparse.ArgumentParser(
        description='Test processing for an existing video file'
    )
    parser.add_argument(
        'video_path',
        help='Path to the video file to process'
    )
    parser.add_argument(
        '--frames-dir', default='frames',
        help='Directory to save extracted frames (default: frames)'
    )
    parser.add_argument(
        '--cropped-dir', default='cropped',
        help='Directory to save cropped videos (default: cropped)'
    )
    parser.add_argument(
        '--captions-dir', default='captions',
        help='Directory to save caption data (default: captions)'
    )
    
    args = parser.parse_args()
    
    # Check if video file exists
    if not os.path.exists(args.video_path):
        logger.error(f"Video file not found: {args.video_path}")
        return
    
    # Ensure output directories exist
    output_dirs = {
        'frames': args.frames_dir,
        'cropped': args.cropped_dir,
        'captions': args.captions_dir
    }
    
    for dir_path in output_dirs.values():
        os.makedirs(dir_path, exist_ok=True)
    
    # Process video
    result = process_existing_video(args.video_path, output_dirs)
    
    # Store result in database if successful
    if result['success']:
        store_success = store_result_in_db(result)
        db_status = "Stored in database" if store_success else "Failed to store in database"
    else:
        db_status = "Not stored in database due to processing failure"
    
    # Print result
    status = "Success" if result['success'] else "Failed"
    print(f"\nProcessing result: {status}")
    print(f"Video ID: {result['video_id']}")
    if result['success']:
        print(f"Caption: {result['caption_text']}")
        print(f"Video path: {result['video_path']}")
    print(f"Database: {db_status}")

if __name__ == "__main__":
    main() 