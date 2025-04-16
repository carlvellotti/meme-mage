#### **Chunk 2: Extract a Representative Frame**
- **Goal**: Extract a single frame from each video that clearly shows the caption text for OCR processing.
- **Tools**: FFmpeg (command-line) or OpenCV (Python).
- **Steps**:
  1. Choose a method:
     - **FFmpeg**: Extract the first frame via a subprocess call.
     - **OpenCV**: Use Python to read the video and capture a frame.
  2. Write a script to process each video from Chunk 1.
  3. Save the frame as an image file in a `frames/` directory (e.g., `VIDEO_ID1_frame.jpg`).
- **Example Code (OpenCV)**:
  ```python
  import cv2
  import os

  video_path = "videos/VIDEO_ID1.mp4"
  os.makedirs("frames", exist_ok=True)
  cap = cv2.VideoCapture(video_path)
  success, frame = cap.read()
  if success:
      cv2.imwrite(f"frames/{video_path.split('/')[-1].split('.')[0]}_frame.jpg", frame)
  cap.release()
  ```
- **Output**: One image file per video (e.g., `frames/VIDEO_ID1_frame.jpg`) containing the caption.
- **Why**: A single frame simplifies OCR by focusing on static text, avoiding the need to process the entire video.

## Implementation

We've implemented a robust frame extraction solution using FFmpeg, which provides several advantages over the OpenCV approach:

### Features Implemented
- **FFmpeg-based Extraction**:
  - More efficient than OpenCV for simple frame extraction
  - No dependency on large computer vision libraries
  - Direct integration with the video processing pipeline from Chunk 1

- **Enhanced Frame Selection**:
  - Support for time-offset frame extraction (any point in the video)
  - High-quality image output optimization for OCR readability
  - Consistent frame extraction across different video formats

- **Robust Processing**:
  - Handles errors gracefully with informative messages
  - Validates output to ensure frame was actually extracted
  - Maintains naming consistency with source videos

- **Command-line Interface**:
  - Flexible argument structure for various use cases
  - Support for both individual video and batch processing
  - Custom output directory specification

### Implementation Details
Our `frame_extractor.py` script includes:

1. **FFmpeg Integration**:
   ```python
   def extract_frame(video_path, output_dir="frames", time_offset=0):
       # Create output directory if it doesn't exist
       os.makedirs(output_dir, exist_ok=True)
       
       # Extract video ID from the filename
       video_filename = os.path.basename(video_path)
       video_id = os.path.splitext(video_filename)[0]
       output_path = f"{output_dir}/{video_id}_frame.jpg"
       
       # Use FFmpeg to extract a frame
       cmd = [
           "ffmpeg",
           "-i", video_path,
           "-ss", str(time_offset),  # Time offset
           "-frames:v", "1",  # One frame only
           "-q:v", "2",  # High quality
           "-y",  # Overwrite if exists
           output_path
       ]
       
       # Run the command
       result = subprocess.run(cmd, capture_output=True, text=True)
   ```

2. **Batch Processing Capabilities**:
   ```python
   def process_videos(videos_dir="videos", output_dir="frames", time_offset=0):
       # Get all video files in the videos directory
       video_files = glob.glob(os.path.join(videos_dir, "*.mp4"))
       
       # Process each video
       for video_path in video_files:
           success, result = extract_frame(video_path, output_dir, time_offset)
   ```

### Testing and Results
The script was tested with Instagram videos downloaded through our Chunk 1 implementation:

- Successfully extracted frames from videos of various durations
- Verified consistent output quality and naming
- Tested extraction at different time offsets to capture optimal frames
- Confirmed the extracted frames contained readable caption text

### Future Integration
In a future chunk, we'll develop a coordinating script that creates a seamless pipeline:
1. Download videos from Instagram URLs
2. Extract representative frames from each video
3. Process frames with OCR to extract caption text
4. Store all components together in a structured database

This modular approach ensures each component can be developed and tested independently, while still working together as part of a complete system. 