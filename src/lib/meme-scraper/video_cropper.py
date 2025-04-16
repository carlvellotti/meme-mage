import cv2
import numpy as np
import subprocess
import os
import argparse
import glob
from pathlib import Path

def detect_content_region(frame_path):
    """
    Detect the main content region in a frame using cv2.inRange to exclude
    near-black and near-white bars.
    
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
    
    # Create debug directory for saving intermediate images - REMOVED FOR PRODUCTION
    # debug_dir = os.path.join(os.path.dirname(frame_path), "debug")
    # os.makedirs(debug_dir, exist_ok=True)
    # debug_prefix = os.path.join(debug_dir, os.path.basename(frame_path).split('.')[0])
    
    # Save original frame for debugging - REMOVED FOR PRODUCTION
    # cv2.imwrite(f"{debug_prefix}_frame_original.jpg", frame)

    # Convert to grayscale
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Define near-black and near-white ranges
    lower_black = 0
    upper_black = 10 # Pixels <= 10 are considered black bars
    lower_white = 235 # Pixels >= 235 are considered white bars (Adjusted from 245)
    upper_white = 255
    
    # Create masks for black and white bars
    black_mask = cv2.inRange(gray, lower_black, upper_black)
    white_mask = cv2.inRange(gray, lower_white, upper_white)
    
    # Combine masks to get all bar pixels
    bar_mask = cv2.bitwise_or(black_mask, white_mask)
    # cv2.imwrite(f"{debug_prefix}_bar_mask.jpg", bar_mask) # REMOVED DEBUG SAVE
    
    # Invert the mask to get the content mask (everything NOT a bar)
    content_mask = cv2.bitwise_not(bar_mask)
    # cv2.imwrite(f"{debug_prefix}_content_mask_raw.jpg", content_mask) # REMOVED DEBUG SAVE
    
    # Apply morphological erosion to remove thin borders/noise from the content mask
    kernel = np.ones((3,3), np.uint8)
    content_mask_eroded = cv2.erode(content_mask, kernel, iterations=1)
    # cv2.imwrite(f"{debug_prefix}_content_mask_eroded.jpg", content_mask_eroded) # REMOVED DEBUG SAVE
    
    # Find contours in the eroded content mask
    contours, _ = cv2.findContours(content_mask_eroded, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    best_crop = None
    max_area = 0
    
    if contours:
        # Find the largest contour
        largest_contour = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(largest_contour)
        area = w * h
        frame_area = frame_width * frame_height
        area_percent = area / frame_area
        
        print(f"Largest contour found: x={x}, y={y}, w={w}, h={h}, area%={area_percent:.2%}")
        
        # Sanity check: Ensure the detected area is reasonably sized
        if 0.1 < area_percent < 0.98: # Area between 10% and 98% of frame
            best_crop = (x, y, w, h)
            method = "inRange"
            print(f"Selected crop method: {method}, area: {area_percent:.2%}")
        else:
            print(f"Largest contour area ({area_percent:.2%}) outside valid range (10%-98%). Falling back.")
            
    # If no valid contour found, use the default fallback
    if best_crop is None:
        print("inRange detection failed or produced invalid area. Using a conservative default crop.")
        method = "default"
        # Use a reasonable default that works for most Instagram memes
        margin_x = int(frame_width * 0.05)  # 5% margin from edges
        margin_top = int(frame_height * 0.25)  # 25% from top (to skip caption area)
        margin_bottom = int(frame_height * 0.05)  # 5% from bottom
        
        x = margin_x
        y = margin_top
        w = frame_width - (2 * margin_x)
        h = frame_height - margin_top - margin_bottom
        
        best_crop = (x, y, w, h)

    # Draw the final crop rectangle on the frame for debugging - REMOVED FOR PRODUCTION
    # x_draw, y_draw, w_draw, h_draw = best_crop # Use separate variables for drawing if needed
    # debug_frame = frame.copy()
    # cv2.rectangle(debug_frame, (x_draw, y_draw), (x_draw + w_draw, y_draw + h_draw), (0, 255, 0), 3)
    # cv2.putText(debug_frame, f"{method}: {w_draw}x{h_draw} @ ({x_draw},{y_draw})", (x_draw, y_draw-10), 
    #            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    # cv2.imwrite(f"{debug_prefix}_crop_final.jpg", debug_frame)
        
    return best_crop

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
    
    # Ensure width and height are positive and non-zero
    if w <= 0 or h <= 0:
        print(f"Error: Invalid crop dimensions w={w}, h={h}. Skipping crop for {video_path}")
        return False # Indicate failure, but maybe copy original?
    
    # Ensure crop coordinates are within frame boundaries
    # (Add checks here if necessary, though ffmpeg usually handles this)
    
    # Build FFmpeg command
    cmd = [
        "ffmpeg",
        "-i", video_path,
        "-vf", f"crop={w}:{h}:{x}:{y}",
        "-c:a", "copy",  # Copy audio stream without re-encoding
        "-y",  # Overwrite output file if it exists
        "-v", "error", # Reduce ffmpeg verbosity
        output_path
    ]
    
    try:
        # Run FFmpeg command
        print(f"Executing FFmpeg crop command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        
        # Check if the command was successful
        if result.returncode != 0:
            print(f"Error cropping video {video_path}:")
            print(f"FFmpeg stderr: {result.stderr}")
            print(f"FFmpeg stdout: {result.stdout}")
            return False
        
        # Verify output file exists and has size
        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
             print(f"Error: Cropped video file {output_path} was not created or is empty.")
             print(f"FFmpeg stderr: {result.stderr}")
             print(f"FFmpeg stdout: {result.stdout}")
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
        print(f"Error: Could not detect content region in frame {frame_path}. Skipping crop.")
        # Decide how to handle - maybe return original video path or None?
        # For now, return None to indicate cropping didn't happen
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
        # If cropping failed, perhaps return original path or handle differently?
        print(f"Cropping failed for {video_path}, using original video.")
        # For now, let's still return None if CROP failed.
        # If we wanted to upload the original, we'd return video_path here.
        return None

def process_video(video_path, frames_dir="frames", output_dir="cropped"):
    """
    Extract frame, detect content, crop video.
    """
    # 1. Extract a frame (assuming function exists)
    from frame_extractor import extract_frame
    frame_path = extract_frame(video_path, output_dir=frames_dir, time_offset=1) # Extract frame at 1 second
    if not frame_path:
        print(f"Failed to extract frame for {video_path}")
        return None, None # Return None for both frame and cropped video

    # 2. Crop the video using the extracted frame
    cropped_video_path = crop_video(video_path, frame_path, output_dir)
    
    # Return the frame path and the cropped video path (which might be None if cropping failed)
    return frame_path, cropped_video_path


def main():
    parser = argparse.ArgumentParser(description='Detect content region and crop Instagram videos.')
    parser.add_argument('video_path', help='Path to the video file')
    parser.add_argument('frame_path', help='Path to the extracted frame image')
    parser.add_argument('-o', '--output-dir', default='cropped', help='Directory to save the cropped video')
    args = parser.parse_args()

    cropped_path = crop_video(args.video_path, args.frame_path, args.output_dir)

    if cropped_path:
        print(f"Cropped video saved to: {cropped_path}")
    else:
        print("Video cropping failed.")

if __name__ == "__main__":
    # This main function is primarily for testing the cropping logic directly.
    # The main process will likely call process_video or crop_video.
    pass # Replace with test logic if needed 