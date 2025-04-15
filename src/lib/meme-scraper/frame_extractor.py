import os
import subprocess
import argparse
import glob

def extract_frame(video_path, output_dir="frames", time_offset=0):
    """
    Extract a single frame from a video file using FFmpeg.
    
    Args:
        video_path: Path to the video file
        output_dir: Directory to save the extracted frame
        time_offset: Time offset in seconds for frame extraction (default: 0 - first frame)
    
    Returns:
        str: Path to the extracted frame, or None if extraction failed
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Extract video ID from the filename
    video_filename = os.path.basename(video_path)
    video_id = os.path.splitext(video_filename)[0]
    output_path = f"{output_dir}/{video_id}_frame.jpg"
    
    try:
        # Use FFmpeg to extract a frame
        cmd = [
            "ffmpeg",
            "-i", video_path,  # Input file
            "-ss", str(time_offset),  # Seek to specific time
            "-frames:v", "1",  # Extract only one frame
            "-q:v", "2",  # High quality
            "-y",  # Overwrite output file if exists
            output_path
        ]
        
        # Run the FFmpeg command
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"Error: FFmpeg failed: {result.stderr}")
            return None
        
        # Check if the output file exists
        if not os.path.exists(output_path):
            print(f"Error: Frame extraction failed - no output file")
            return None
        
        return output_path
    
    except Exception as e:
        print(f"Error processing {video_path}: {str(e)}")
        return None

def _extract_frame_with_status(video_path, output_dir="frames", time_offset=0):
    """
    Legacy version that returns a tuple with status and result.
    Used by the process_videos function.
    """
    output_path = extract_frame(video_path, output_dir, time_offset)
    if output_path:
        return True, output_path
    else:
        return False, f"Error extracting frame from {video_path}"

def process_videos(videos_dir="videos", output_dir="frames", time_offset=0):
    """
    Process all videos in the specified directory.
    
    Args:
        videos_dir: Directory containing the videos
        output_dir: Directory to save the extracted frames
        time_offset: Time offset in seconds for frame extraction
    
    Returns:
        dict: Summary of processing results
    """
    results = {
        "successful": 0,
        "failed": 0,
        "total": 0,
        "errors": []
    }
    
    # Get all video files in the videos directory
    video_files = glob.glob(os.path.join(videos_dir, "*.mp4"))
    results["total"] = len(video_files)
    
    if len(video_files) == 0:
        print(f"No video files found in {videos_dir}")
        return results
    
    # Process each video
    for video_path in video_files:
        print(f"Processing {video_path}...")
        success, result = _extract_frame_with_status(video_path, output_dir, time_offset)
        
        if success:
            print(f"  Extracted frame saved to {result}")
            results["successful"] += 1
        else:
            print(f"  {result}")
            results["failed"] += 1
            results["errors"].append(result)
    
    return results

def main():
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Extract frames from Instagram videos using FFmpeg')
    parser.add_argument('-i', '--input-dir', default='videos', help='Directory containing the videos')
    parser.add_argument('-o', '--output-dir', default='frames', help='Directory to save the extracted frames')
    parser.add_argument('-t', '--time', type=float, default=0, 
                        help='Time offset in seconds for frame extraction (default: 0 - first frame)')
    parser.add_argument('-v', '--video', help='Process a single video file instead of a directory')
    args = parser.parse_args()
    
    if args.video:
        # Process a single video
        if not os.path.exists(args.video):
            print(f"Error: Video file {args.video} not found")
            return
        
        print(f"Processing single video: {args.video}")
        success, result = _extract_frame_with_status(args.video, args.output_dir, args.time)
        
        if success:
            print(f"Frame extracted successfully: {result}")
        else:
            print(f"Failed to extract frame: {result}")
    else:
        # Process all videos in the directory
        results = process_videos(args.input_dir, args.output_dir, args.time)
        
        # Print summary
        print(f"\nProcessing Summary:")
        print(f"  Successful: {results['successful']}")
        print(f"  Failed: {results['failed']}")
        print(f"  Total: {results['total']}")
        
        if results["successful"] > 0:
            print(f"\nExtracted frames are saved in the '{args.output_dir}' directory.")

if __name__ == "__main__":
    main() 