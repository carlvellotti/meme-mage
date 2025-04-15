import cv2
import numpy as np
import subprocess
import os
import argparse
import glob
from pathlib import Path

def detect_content_region(frame_path):
    """
    Detect the main content region in a frame using contour detection.
    Handles both dark and light backgrounds automatically.
    
    Args:
        frame_path (str): Path to the frame image
        
    Returns:
        tuple: (x, y, width, height) of the detected content region, or None if detection fails
    """
    # Load the frame
    frame = cv2.imread(frame_path)
    if frame is None:
        print(f"Error: Could not read frame at {frame_path}")
        return None
    
    # Get frame dimensions
    frame_height, frame_width = frame.shape[:2]
    
    # Convert to grayscale
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Calculate average brightness to determine if it's a white or dark background
    average_brightness = np.mean(gray)
    
    # Create debug directory for saving intermediate images
    debug_dir = os.path.join(os.path.dirname(frame_path), "debug")
    os.makedirs(debug_dir, exist_ok=True)
    debug_prefix = os.path.join(debug_dir, os.path.basename(frame_path).split('.')[0])
    
    # Save original frame for debugging
    cv2.imwrite(f"{debug_prefix}_frame_top.jpg", frame)
    
    # Determine if we have a light or dark background
    is_light_background = average_brightness > 180
    print(f"Image brightness: {average_brightness:.1f}, {'light' if is_light_background else 'dark'} background detected")
    
    # Try multiple thresholding approaches
    crops = []
    
    # Approach 1: Basic thresholding based on background type
    if is_light_background:
        # For light backgrounds, use inverse binary threshold to find dark text/content
        _, thresh1 = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY_INV)
    else:
        # For dark backgrounds, use standard binary threshold
        _, thresh1 = cv2.threshold(gray, 30, 255, cv2.THRESH_BINARY)
    
    cv2.imwrite(f"{debug_prefix}_thresh1.jpg", thresh1)
    
    # Find contours in the first threshold image
    contours1, _ = cv2.findContours(thresh1, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if contours1:
        largest_contour1 = max(contours1, key=cv2.contourArea)
        x1, y1, w1, h1 = cv2.boundingRect(largest_contour1)
        area_percent1 = (w1 * h1) / (frame_width * frame_height)
        
        # Only consider valid crops (not too small, not the entire frame)
        if 0.1 < area_percent1 < 0.95:
            crops.append((x1, y1, w1, h1, area_percent1, "basic"))
    
    # Approach 2: Adaptive thresholding (works well for varying lighting)
    adaptive_thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY_INV if is_light_background else cv2.THRESH_BINARY, 
        11, 2
    )
    cv2.imwrite(f"{debug_prefix}_thresh_adaptive.jpg", adaptive_thresh)
    
    # Find contours in the adaptive threshold image
    contours2, _ = cv2.findContours(adaptive_thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if contours2:
        largest_contour2 = max(contours2, key=cv2.contourArea)
        x2, y2, w2, h2 = cv2.boundingRect(largest_contour2)
        area_percent2 = (w2 * h2) / (frame_width * frame_height)
        
        # Only consider valid crops
        if 0.1 < area_percent2 < 0.95:
            crops.append((x2, y2, w2, h2, area_percent2, "adaptive"))
    
    # Approach 3: Edge detection (good for finding boundaries)
    edges = cv2.Canny(gray, 100, 200)
    # Dilate to connect nearby edges
    kernel = np.ones((5,5), np.uint8)
    dilated_edges = cv2.dilate(edges, kernel, iterations=1)
    cv2.imwrite(f"{debug_prefix}_edges.jpg", dilated_edges)
    
    # Find contours in the edge image
    contours3, _ = cv2.findContours(dilated_edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if contours3:
        largest_contour3 = max(contours3, key=cv2.contourArea)
        x3, y3, w3, h3 = cv2.boundingRect(largest_contour3)
        area_percent3 = (w3 * h3) / (frame_width * frame_height)
        
        # Only consider valid crops
        if 0.1 < area_percent3 < 0.95:
            crops.append((x3, y3, w3, h3, area_percent3, "edge"))
    
    # If no good crops found from the above approaches, use a fallback method
    if not crops:
        # For light backgrounds, try a different threshold value
        if is_light_background:
            _, thresh_fallback = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY_INV)
            cv2.imwrite(f"{debug_prefix}_thresh_fallback.jpg", thresh_fallback)
            
            contours_fallback, _ = cv2.findContours(thresh_fallback, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if contours_fallback:
                largest_contour_fallback = max(contours_fallback, key=cv2.contourArea)
                x_fb, y_fb, w_fb, h_fb = cv2.boundingRect(largest_contour_fallback)
                area_percent_fb = (w_fb * h_fb) / (frame_width * frame_height)
                
                # More permissive area range
                if 0.05 < area_percent_fb < 0.98:
                    crops.append((x_fb, y_fb, w_fb, h_fb, area_percent_fb, "fallback"))
    
    # Last resort: If all else fails, use a reasonable fixed crop with margins
    if not crops:
        print("All detection methods failed. Using a conservative default crop.")
        # Use a reasonable default that works for most Instagram memes
        margin_x = int(frame_width * 0.05)  # 5% margin from edges
        margin_top = int(frame_height * 0.25)  # 25% from top (to skip caption area)
        margin_bottom = int(frame_height * 0.05)  # 5% from bottom
        
        x_default = margin_x
        y_default = margin_top
        w_default = frame_width - (2 * margin_x)
        h_default = frame_height - margin_top - margin_bottom
        
        crops.append((x_default, y_default, w_default, h_default, 0.7, "default"))
    
    # Choose the best crop (for now, select the one with the largest area that's not too large)
    # Sort crops by area percentage in descending order
    crops.sort(key=lambda c: c[4], reverse=True)
    
    # Select the first valid crop
    for crop in crops:
        x, y, w, h, area_percent, method = crop
        print(f"Selected crop method: {method}, area: {area_percent:.2%}")
        
        # Draw the crop rectangle on the frame for debugging
        debug_frame = frame.copy()
        cv2.rectangle(debug_frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
        cv2.putText(debug_frame, f"{method}: {area_percent:.2%}", (x, y-10), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
        cv2.imwrite(f"{debug_prefix}_crop_{method}.jpg", debug_frame)
        
        return (x, y, w, h)
    
    # Should not reach here since we have a default fallback
    return None

def crop_video_with_params(video_path, crop_params, output_dir="cropped"):
    """
    Crop a video using FFmpeg based on the provided coordinates.
    
    Args:
        video_path (str): Path to the video file
        crop_params (tuple): (x, y, width, height) for cropping
        output_dir (str): Directory to save the cropped video
        
    Returns:
        bool: True if successful, False otherwise
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Extract video ID from filename
    video_filename = os.path.basename(video_path)
    video_id = Path(video_filename).stem
    output_path = os.path.join(output_dir, f"{video_id}.mp4")
    
    # Extract crop parameters
    x, y, w, h = crop_params
    
    # Build FFmpeg command
    cmd = [
        "ffmpeg",
        "-i", video_path,
        "-vf", f"crop={w}:{h}:{x}:{y}",
        "-c:a", "copy",  # Copy audio stream without re-encoding
        "-y",  # Overwrite output file if it exists
        output_path
    ]
    
    try:
        # Run FFmpeg command
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        # Check if the command was successful
        if result.returncode != 0:
            print(f"Error cropping video {video_path}:")
            print(result.stderr)
            return False
        
        print(f"Successfully cropped video: {output_path}")
        return True
    except Exception as e:
        print(f"Exception while cropping video {video_path}: {str(e)}")
        return False

def crop_video(video_path, frame_path, output_dir="cropped"):
    """
    Crop a video based on the content region detected in the frame.
    
    Args:
        video_path (str): Path to the video file
        frame_path (str): Path to the frame image
        output_dir (str): Directory to save the cropped video
        
    Returns:
        str: Path to the cropped video if successful, None otherwise
    """
    # Detect content region
    crop_params = detect_content_region(frame_path)
    
    if crop_params is None:
        print(f"Error: Could not detect content region in frame {frame_path}")
        return None
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate output path
    video_filename = os.path.basename(video_path)
    video_id = Path(video_filename).stem
    output_path = os.path.join(output_dir, f"{video_id}.mp4")
    
    # Crop video
    success = crop_video_with_params(video_path, crop_params, output_dir)
    
    if success:
        return output_path
    else:
        return None

def process_video(video_path, frames_dir="frames", output_dir="cropped"):
    """
    Process a single video: find its frame, detect content region, and crop.
    
    Args:
        video_path (str): Path to the video file
        frames_dir (str): Directory containing extracted frames
        output_dir (str): Directory to save cropped videos
        
    Returns:
        bool: True if successful, False otherwise
    """
    # Get video ID
    video_filename = os.path.basename(video_path)
    video_id = Path(video_filename).stem
    
    # Find corresponding frame
    frame_path = os.path.join(frames_dir, f"{video_id}_frame.jpg")
    
    if not os.path.exists(frame_path):
        print(f"Error: Frame not found for video {video_path} at {frame_path}")
        return False
    
    # Crop the video
    output_path = crop_video(video_path, frame_path, output_dir)
    
    return output_path is not None

def batch_process(videos_dir="videos", frames_dir="frames", output_dir="cropped"):
    """
    Process all videos in the specified directory.
    
    Args:
        videos_dir (str): Directory containing video files
        frames_dir (str): Directory containing extracted frames
        output_dir (str): Directory to save cropped videos
        
    Returns:
        tuple: (success_count, fail_count)
    """
    # Get all video files
    video_files = glob.glob(os.path.join(videos_dir, "*.mp4"))
    
    if not video_files:
        print(f"No video files found in {videos_dir}")
        return 0, 0
    
    # Process each video
    success_count = 0
    fail_count = 0
    
    for video_path in video_files:
        print(f"Processing: {video_path}")
        success = process_video(video_path, frames_dir, output_dir)
        
        if success:
            success_count += 1
        else:
            fail_count += 1
    
    return success_count, fail_count

def main():
    """
    Main function to parse arguments and execute video cropping.
    """
    parser = argparse.ArgumentParser(description="Crop videos to remove borders and captions")
    parser.add_argument("--videos", default="videos", help="Directory containing video files")
    parser.add_argument("--frames", default="frames", help="Directory containing extracted frames")
    parser.add_argument("--output", default="cropped", help="Directory to save cropped videos")
    parser.add_argument("--single", help="Process a single video file")
    
    args = parser.parse_args()
    
    # Process a single video or batch process
    if args.single:
        if not os.path.exists(args.single):
            print(f"Error: Video file not found: {args.single}")
            return
        
        success = process_video(args.single, args.frames, args.output)
        
        if success:
            print(f"Successfully processed video: {args.single}")
        else:
            print(f"Failed to process video: {args.single}")
    else:
        success_count, fail_count = batch_process(args.videos, args.frames, args.output)
        
        print(f"\nProcessing complete!")
        print(f"Successfully processed: {success_count} videos")
        print(f"Failed to process: {fail_count} videos")

if __name__ == "__main__":
    main() 