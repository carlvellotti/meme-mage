#### **Chunk 4: Extract Caption Text with Google Cloud Vision API**
- **Goal**: Extract the caption text from the frame using Google Cloud Vision API for storage in the database.
- **Tools**: Google Cloud Vision API, OpenCV (for preprocessing and region extraction).
- **Steps**:
  1. Load the frame from Chunk 2 (e.g., `VIDEO_ID1_frame.jpg`).
  2. Extract the top region (40% of the frame height) where captions are typically located.
  3. Send the image to Google Cloud Vision API for text detection.
  4. If no text is found in the top region, try analyzing the full frame as a fallback.
  5. Process multi-line captions by properly joining them into a coherent text.
  6. Clean the extracted text and save to both individual files and a JSON mapping.
- **Example Code**:
  ```python
  import os
  import cv2
  import base64
  import requests
  import json
  
  # Google Cloud Vision API setup
  API_KEY = "YOUR_API_KEY"
  VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate"
  
  # Extract top 40% of the image where caption is likely to be
  def extract_top_region(image_path):
      img = cv2.imread(image_path)
      height, width = img.shape[:2]
      top_region_height = int(height * 0.4)
      top_region = img[0:top_region_height, 0:width]
      
      # Save for debugging
      output_path = "debug/top_region.jpg"
      os.makedirs(os.path.dirname(output_path), exist_ok=True)
      cv2.imwrite(output_path, top_region)
      return output_path
  
  # Process with Google Cloud Vision API
  def detect_text_google_vision(image_path):
      with open(image_path, "rb") as image_file:
          content = image_file.read()
      
      encoded_content = base64.b64encode(content).decode("utf-8")
      
      request_payload = {
          "requests": [{
              "image": {"content": encoded_content},
              "features": [{"type": "TEXT_DETECTION"}]
          }]
      }
      
      response = requests.post(
          f"{VISION_API_URL}?key={API_KEY}",
          headers={"Content-Type": "application/json"},
          json=request_payload
      )
      
      if response.status_code == 200:
          response_json = response.json()
          text_annotations = response_json.get("responses", [{}])[0].get("textAnnotations", [])
          
          if text_annotations:
              return text_annotations[0].get("description", "")
      
      return ""
      
  # Clean and process multi-line captions
  def clean_text(text):
      if not text:
          return ""
      
      lines = text.strip().split('\n')
      
      if len(lines) > 1:
          cleaned_lines = []
          for line in lines:
              line = line.strip()
              if line:
                  cleaned_lines.append(line)
          
          return ' '.join(cleaned_lines)
      
      return text.strip()
  ```
- **Advantages Over Original Approach**:
  1. **Improved Accuracy**: Google Cloud Vision API offers superior text recognition compared to Tesseract.
  2. **Multi-line Support**: Properly handles captions that span multiple lines.
  3. **Adaptive Processing**: Tries the top region first, then falls back to the full frame if needed.
  4. **Better Language Support**: Better handles various fonts, languages, and text styles.
- **Output**: A string containing the full caption, including multiple lines properly joined (e.g., `"POV: when a customer asks me a question after I closed the sale"`).
- **Why**: Using cloud-based OCR provides higher accuracy for various caption styles and formats commonly found in Instagram memes. 