import subprocess
import os
import sys
import argparse
import shutil
from urllib.parse import urlparse

def extract_video_id(url):
    """Extract the video ID from an Instagram URL."""
    # Parse the URL and split the path
    parsed_url = urlparse(url)
    path_parts = parsed_url.path.strip('/').split('/')
    
    # The ID should be after "reel" or "p" in the path
    if 'reel' in path_parts:
        idx = path_parts.index('reel')
        if idx + 1 < len(path_parts):
            return path_parts[idx + 1]
    elif 'p' in path_parts:
        idx = path_parts.index('p')
        if idx + 1 < len(path_parts):
            return path_parts[idx + 1]
    
    # Fallback: use the second-to-last part of the path if it exists
    if len(path_parts) >= 2:
        return path_parts[-2]
    
    # Last resort: use the entire path as a unique identifier
    return parsed_url.path.strip('/').replace('/', '_')

def check_ffmpeg():
    """Check if ffmpeg is installed."""
    try:
        subprocess.run(["ffmpeg", "-version"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def download_reel(url, output_dir="videos"):
    """Download an Instagram video to the specified directory."""
    # Create the output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Extract the video ID from the URL
    video_id = extract_video_id(url)
    
    # Ensure we have a proper video ID for the filename
    if not video_id or video_id.lower() == "reel" or video_id.lower() == "reels":
        # Get a more specific ID from the URL - use the last part of the path
        parsed_url = urlparse(url)
        path_parts = parsed_url.path.strip('/').split('/')
        # Use the last part if it exists
        if path_parts and len(path_parts) > 0:
            video_id = path_parts[-1]
        # If we still don't have a good ID, use a timestamp
        if not video_id or video_id.lower() in ["reel", "reels", "p"]:
            import time
            video_id = f"instagram_{int(time.time())}"
    
    print(f"Using video ID: {video_id}")
    
    # Download the video with yt-dlp
    temp_output = f"{output_dir}/temp_{video_id}.mp4"
    final_output = f"{output_dir}/{video_id}.mp4"
    print(f"Downloading {url}")
    
    try:
        # Step 1: Download the video with yt-dlp
        result = subprocess.run([
            "yt-dlp", 
            url, 
            "-o", temp_output,
            "--format", "mp4"
        ], check=True, capture_output=True, text=True)
        
        # Step 2: Convert the video to H.264 format for QuickTime compatibility
        if check_ffmpeg():
            print(f"Converting to QuickTime-compatible format...")
            subprocess.run([
                "ffmpeg", 
                "-i", temp_output,
                "-c:v", "h264", 
                "-c:a", "aac",
                "-movflags", "+faststart",
                "-y",
                final_output
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            # Remove the temporary file
            os.remove(temp_output)
            print(f"Saved to {final_output}")
        else:
            # If ffmpeg is not installed, just use the downloaded file
            shutil.move(temp_output, final_output)
            print(f"ffmpeg not found - video saved without conversion")
            print(f"To ensure QuickTime compatibility, please install ffmpeg.")
        
        return video_id, True, None
    except subprocess.CalledProcessError as e:
        error_message = f"Failed to download/convert {url}: {e.stderr}"
        if os.path.exists(temp_output):
            os.remove(temp_output)
        return video_id, False, error_message

def download_video(url, output_dir="videos"):
    """
    Download an Instagram video and return the full path to the file
    
    Args:
        url (str): Instagram URL to download
        output_dir (str): Directory to save the video
        
    Returns:
        str: Full path to the downloaded video file, or None if download failed
    """
    video_id, success, error = download_reel(url, output_dir)
    if success:
        video_path = os.path.join(output_dir, f"{video_id}.mp4")
        if os.path.exists(video_path):
            return video_path
    else:
        # Print the detailed error message from download_reel (which contains yt-dlp stderr)
        # to sys.stderr so it doesn't interfere with JSON output on stdout.
        print(f"Error downloading video: {error}", file=sys.stderr)
    return None

def main():
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Download Instagram videos')
    parser.add_argument('urls', nargs='*', help='Instagram URLs to download')
    parser.add_argument('-o', '--output-dir', default='videos', help='Directory to save videos to')
    args = parser.parse_args()
    
    # List of Instagram URLs to download
    urls = args.urls
    if not urls:
        # Default URLs if none provided
        urls = [
            "https://www.instagram.com/p/DF6DJNNALxO/",
            "https://www.instagram.com/p/DIQ4YvcxieW/"
        ]
    
    # Check if ffmpeg is installed
    has_ffmpeg = check_ffmpeg()
    if not has_ffmpeg:
        print("Warning: ffmpeg is not installed. Videos will be downloaded but may not be compatible with QuickTime.")
        print("To install ffmpeg on macOS, run: brew install ffmpeg")
    
    # Download each video
    successful = 0
    failed = 0
    for url in urls:
        video_id, success, error = download_reel(url, args.output_dir)
        if success:
            successful += 1
        else:
            failed += 1
            print(error)
    
    # Print summary
    print(f"\nDownload Summary:")
    print(f"  Successful: {successful}")
    print(f"  Failed: {failed}")
    print(f"  Total: {len(urls)}")
    
    if successful > 0 and has_ffmpeg:
        print("\nNote: Videos have been converted to a format compatible with QuickTime.")

if __name__ == "__main__":
    main() 