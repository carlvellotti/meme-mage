#!/usr/bin/env python3
import os
import argparse
import cv2
import json
from pathlib import Path
import base64
import requests

# Google Cloud Vision API setup
# Using the provided token as an API key
API_KEY = "AIzaSyCEhr56raKurvj6fAcMTsvAvmaL-JU5voc"
VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate"

def extract_top_region(image_path):
    """Extract the top region of the image where the caption is likely to be"""
    # Read the image
    img = cv2.imread(image_path)
    
    # Get dimensions
    height, width = img.shape[:2]
    
    # Extract top region (approximately 40% of the image) - increased from 25% to capture multi-line captions
    top_region_height = int(height * 0.4)
    top_region = img[0:top_region_height, 0:width]
    
    # Save the top region for debugging
    debug_dir = os.path.join(os.path.dirname(image_path), "debug")
    os.makedirs(debug_dir, exist_ok=True)
    base_name = os.path.basename(image_path).split('.')[0]
    output_path = os.path.join(debug_dir, f"{base_name}_top.jpg")
    cv2.imwrite(output_path, top_region)
    
    return output_path

def detect_text_google_vision(image_path):
    """
    Use Google Cloud Vision API to detect text in an image
    """
    # Read image content
    with open(image_path, "rb") as image_file:
        content = image_file.read()
    
    # Encode image in base64
    encoded_content = base64.b64encode(content).decode("utf-8")
    
    # Prepare request payload
    request_payload = {
        "requests": [
            {
                "image": {
                    "content": encoded_content
                },
                "features": [
                    {
                        "type": "TEXT_DETECTION"
                    }
                ]
            }
        ]
    }
    
    # Send request to Google Cloud Vision API with proper API key
    headers = {
        "Content-Type": "application/json"
    }
    
    print(f"Sending request to Google Vision API: {VISION_API_URL}?key=API_KEY_HIDDEN")
    
    # Try the API request
    try:
        # Use API key as a query parameter (standard for Google APIs)
        response = requests.post(
            f"{VISION_API_URL}?key={API_KEY}",
            headers=headers,
            json=request_payload
        )
        print(f"Response status: {response.status_code}")
    except Exception as e:
        print(f"API request error: {e}")
        return ""
    
    # Parse response
    if response.status_code == 200:
        response_json = response.json()
        print(f"Full response: {json.dumps(response_json, indent=2)}")
        
        # Check if any text was detected
        text_annotations = response_json.get("responses", [{}])[0].get("textAnnotations", [])
        
        if text_annotations:
            # The first element contains the full detected text
            full_text = text_annotations[0].get("description", "")
            
            # Debug print
            print(f"Google Vision detected: {full_text}")
            
            return full_text
        else:
            print("No text annotations found in the response")
    else:
        print(f"Error from Google Vision API: {response.status_code}, {response.text}")
    
    return ""

def clean_text(text):
    """Clean and normalize the extracted text"""
    if not text:
        return ""
        
    # Split into lines to process multi-line captions
    lines = text.strip().split('\n')
    
    # If we have multiple lines, join them to form a complete caption
    if len(lines) > 1:
        # Process each line: remove extra spaces and clean up
        cleaned_lines = []
        for line in lines:
            line = line.strip()
            if line:  # Only add non-empty lines
                cleaned_lines.append(line)
        
        # Join the lines with spaces between them
        return ' '.join(cleaned_lines)
    
    # Single line, just return it cleaned
    return text.strip()

def extract_caption(frame_path, output_dir="captions"):
    """
    Extract caption from a frame and return the text
    
    Args:
        frame_path (str): Path to the frame image
        output_dir (str): Directory to save the caption text file
        
    Returns:
        str: Extracted caption text
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Get base filename without extension
    base_name = os.path.basename(frame_path)
    video_id = os.path.splitext(base_name)[0].replace("_frame", "")
    
    try:
        # Extract the top region where the caption is likely to be
        top_region_path = extract_top_region(frame_path)
        
        print(f"Trying OCR on top region first...")
        # Use Google Cloud Vision API for OCR on top region
        raw_text = detect_text_google_vision(top_region_path)
        
        # If no text found in top region, try the full frame
        if not raw_text:
            print(f"No text found in top region, trying full frame...")
            raw_text = detect_text_google_vision(frame_path)
        
        # Clean text
        caption = clean_text(raw_text)
        
        # Create output path
        txt_path = os.path.join(output_dir, f"{video_id}_caption.txt")
        
        # Save caption to file
        with open(txt_path, 'w') as f:
            f.write(caption)
            
        return caption
    except Exception as e:
        print(f"Error extracting caption from {frame_path}: {e}")
        return ""

def process_frame(frame_path, output_dir):
    """Process a single frame to extract caption"""
    try:
        # Get base filename without extension
        base_name = os.path.basename(frame_path)
        video_id = os.path.splitext(base_name)[0].replace("_frame", "")
        
        # Extract caption using the new function
        caption = extract_caption(frame_path, output_dir)
            
        return video_id, caption
    except Exception as e:
        print(f"Error processing {frame_path}: {e}")
        return None, None

def main():
    parser = argparse.ArgumentParser(description="Extract captions from frames using Google Cloud Vision API")
    parser.add_argument("--frames", default="frames", help="Directory containing extracted frames")
    parser.add_argument("--output", default="captions", help="Directory to save extracted captions")
    parser.add_argument("--single", help="Process a single frame file")
    
    args = parser.parse_args()
    
    # Create output directory if it doesn't exist
    output_dir = Path(args.output)
    output_dir.mkdir(exist_ok=True)
    
    # Store mapping between video IDs and captions
    caption_data = {}
    
    if args.single:
        # Process a single frame
        video_id, caption = process_frame(args.single, args.output)
        if video_id:
            caption_data[video_id] = caption
    else:
        # Process all frames in the directory
        frames_dir = Path(args.frames)
        frames = list(frames_dir.glob("*_frame.*"))
        
        if not frames:
            print(f"No frames found in {frames_dir}")
            return
        
        print(f"Found {len(frames)} frames to process")
        
        for frame_path in frames:
            print(f"Processing {frame_path}")
            video_id, caption = process_frame(str(frame_path), args.output)
            if video_id:
                caption_data[video_id] = caption
    
    # Save JSON mapping of video IDs to captions
    mapping_path = output_dir / "caption_mapping.json"
    with open(mapping_path, 'w') as f:
        json.dump(caption_data, f, indent=2)
    
    print(f"Caption extraction complete. Processed {len(caption_data)} frames.")
    print(f"Results saved to {output_dir}")

if __name__ == "__main__":
    main() 