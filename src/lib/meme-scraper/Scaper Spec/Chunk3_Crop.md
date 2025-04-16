#### **Chunk 3: Dynamically Detect and Crop the Video Portion**
- **Goal**: Crop each video to isolate the video content, excluding the caption and black borders, despite varying sizes.
- **Tools**: OpenCV (for image processing and cropping).
- **Steps**:
  1. Load the frame from Chunk 2 (e.g., `VIDEO_ID1_frame.jpg`).
  2. Convert the frame to grayscale and apply thresholding to create a binary mask (distinguishing video content from black borders).
  3. Find contours to identify the active video region.
  4. Determine the bounding box of the largest contour (assumed to be the video content).
  5. Crop the original video file using FFmpeg with the bounding box coordinates, saving it in a `cropped/` directory.
- **Example Code**:
  ```python
  import cv2
  import numpy as np
  import subprocess
  import os

  frame_path = "frames/VIDEO_ID1_frame.jpg"
  video_path = "videos/VIDEO_ID1.mp4"
  os.makedirs("cropped", exist_ok=True)

  frame = cv2.imread(frame_path)
  gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
  _, thresh = cv2.threshold(gray, 30, 255, cv2.THRESH_BINARY)
  contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
  x, y, w, h = cv2.boundingRect(max(contours, key=cv2.contourArea))

  # Crop the video using FFmpeg
  output_path = f"cropped/{video_path.split('/')[-1]}"
  subprocess.run(["ffmpeg", "-i", video_path, "-vf", f"crop={w}:{h}:{x}:{y}", "-y", output_path])
  ```
- **Output**: Cropped video file (e.g., `cropped/VIDEO_ID1.mp4`) containing only the video content.
- **Why**: Dynamic cropping ensures the video portion is isolated consistently, regardless of border or caption placement. 

## Implementation

We've implemented a comprehensive solution for dynamically detecting and cropping videos that goes beyond the basic requirements:

### Features Implemented
- **Enhanced Contour Detection**:
  - Robust grayscale conversion and thresholding to isolate video content
  - Validation of detected regions to prevent erroneous crops
  - Handling of edge cases where contours might not be properly detected

- **Video Processing**:
  - Seamless integration with FFmpeg for high-quality video cropping
  - Preservation of audio tracks during the cropping process
  - Consistent output file naming and organization

- **Command-line Interface**:
  - Support for both batch processing and single video operations
  - Customizable input/output directories
  - Detailed processing reports and error handling

- **Error Handling**:
  - Validation of bounding box dimensions (preventing too small or too large crops)
  - Graceful failure reporting when frames or videos can't be processed
  - Comprehensive logging of success and failure cases

### Implementation Details
Our `video_cropper.py` script includes:

1. **Content Region Detection**:
   ```python
   def detect_content_region(frame_path):
       # Load the frame
       frame = cv2.imread(frame_path)
       
       # Convert to grayscale
       gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
       
       # Apply thresholding
       _, thresh = cv2.threshold(gray, 30, 255, cv2.THRESH_BINARY)
       
       # Find contours and identify the largest
       contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
       largest_contour = max(contours, key=cv2.contourArea)
       
       # Get the bounding box with validation
       x, y, w, h = cv2.boundingRect(largest_contour)
       
       # Additional validation to ensure sensible crop dimensions
       frame_height, frame_width = frame.shape[:2]
       area_percent = (w * h) / (frame_width * frame_height)
       if area_percent < 0.1 or area_percent > 0.99:
           return None
   ```

2. **Video Cropping**:
   ```python
   def crop_video(video_path, crop_params, output_dir="cropped"):
       # Create output directory
       os.makedirs(output_dir, exist_ok=True)
       
       # Extract crop parameters
       x, y, w, h = crop_params
       
       # Build FFmpeg command with audio preservation
       cmd = [
           "ffmpeg",
           "-i", video_path,
           "-vf", f"crop={w}:{h}:{x}:{y}",
           "-c:a", "copy",  # Copy audio stream without re-encoding
           "-y",
           output_path
       ]
   ```

### Testing Results
We successfully tested the implementation with multiple Instagram videos:

1. First with the original test video (DF6DJNNALxO.mp4)
2. Then with a newly downloaded Instagram Reel (DIOhTmPt3OL)

The cropper correctly identified the content regions in both videos and produced properly cropped versions that exclude captions and borders.

### Future Enhancements
Potential improvements for the cropping functionality:

- Multiple contour analysis for complex video layouts
- Machine learning-based content detection for ambiguous cases
- Support for animated captions through temporal analysis
- Interactive preview of detected regions 