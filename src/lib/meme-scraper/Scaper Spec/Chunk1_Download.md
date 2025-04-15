#### **Chunk 1: Download the Instagram Reel Video**
- **Goal**: Given a list of Instagram Reel URLs, download each video to your local machine for further processing.
- **Tools**: `yt-dlp` (a command-line video downloader with Python integration).
- **Steps**:
  1. Install `yt-dlp` using pip: `pip install yt-dlp`.
  2. Write a Python script that:
     - Accepts a list of Instagram Reel URLs (e.g., `["https://www.instagram.com/reel/VIDEO_ID1/", ...]`).
     - Loops through each URL and uses `yt-dlp` to download the video.
     - Saves each video with a unique filename (e.g., `VIDEO_ID1.mp4`) in a `videos/` directory.
  3. Test with a sample URL to ensure the video downloads correctly.
- **Example Code**:
  ```python
  import subprocess
  import os

  urls = ["https://www.instagram.com/reel/VIDEO_ID1/", "https://www.instagram.com/reel/VIDEO_ID2/"]
  os.makedirs("videos", exist_ok=True)
  for url in urls:
      video_id = url.split('/')[-2]
      subprocess.run(["yt-dlp", url, "-o", f"videos/{video_id}.%(ext)s"])
  ```
- **Output**: Video files saved locally (e.g., `videos/VIDEO_ID1.mp4`).
- **Why**: This provides the raw material (video files) needed for all subsequent steps.

## Implementation
We have implemented a comprehensive solution for downloading Instagram videos that goes beyond the basic requirements:

### Features Implemented
- **URL Support**:
  - Handles both Instagram posts (`/p/`) and reels (`/reel/`)
  - Supports URLs with usernames (`instagram.com/username/reel/ID/`)
  - Robust extraction of video IDs from any Instagram URL format

- **Enhanced Video Processing**:
  - Downloads videos using yt-dlp's optimized approach
  - Converts videos to H.264 format for QuickTime compatibility
  - Uses ffmpeg for reliable format conversion
  - Ensures audio tracks are properly preserved (AAC format)

- **User Interface**:
  - Command-line argument support for flexible usage
  - Custom output directory specification
  - Detailed download reporting (success/failure counts)
  - Progress information during download and conversion

- **Error Handling**:
  - Checks for required dependencies (ffmpeg)
  - Handles download failures gracefully
  - Cleans up temporary files in case of errors
  - Provides descriptive error messages

### Implementation Details
Our `downloader.py` script includes:

1. **URL Processing** - Extracts video IDs using urllib.parse for reliable URL parsing:
   ```python
   def extract_video_id(url):
       parsed_url = urlparse(url)
       path_parts = parsed_url.path.strip('/').split('/')
       
       if 'reel' in path_parts:
           idx = path_parts.index('reel')
           if idx + 1 < len(path_parts):
               return path_parts[idx + 1]
       elif 'p' in path_parts:
           idx = path_parts.index('p')
           if idx + 1 < len(path_parts):
               return path_parts[idx + 1]
       
       # Fallback methods for unusual URLs...
   ```

2. **Two-Step Download Process**:
   - Initial download with yt-dlp to get the raw Instagram video
   - Conversion using ffmpeg to ensure media player compatibility
   - This approach solves issues with QuickTime compatibility (VP9 vs H.264)

3. **Command-line Interface** using argparse:
   ```python
   parser = argparse.ArgumentParser(description='Download Instagram videos')
   parser.add_argument('urls', nargs='*', help='Instagram URLs to download')
   parser.add_argument('-o', '--output-dir', default='videos', 
                      help='Directory to save videos to')
   ```

### Testing
We thoroughly tested the implementation with various Instagram URL formats:
- Regular posts: `https://www.instagram.com/p/DF6DJNNALxO/`
- Reels: `https://www.instagram.com/reel/DFtO9Y8Ntsx/`
- URLs with username: `https://www.instagram.com/carlthepm/reel/DFtO9Y8Ntsx/`

All videos were successfully downloaded and verified to be playable in QuickTime.

### Usage Examples
```bash
# Download multiple videos
python downloader.py "https://www.instagram.com/p/DF6DJNNALxO/" "https://www.instagram.com/p/DIQ4YvcxieW/"

# Specify custom output directory
python downloader.py -o my_videos "https://www.instagram.com/p/DF6DJNNALxO/"

# See help and options
python downloader.py -h
```

### Future Enhancements
While our implementation exceeds the requirements, potential improvements include:
- Parallel downloads for batch processing
- Support for loading URLs from text files
- Authentication for accessing private content
- Custom naming formats for downloaded videos 