import os
import argparse
import json
from db_manager import DatabaseManager

def load_captions(captions_dir):
    """
    Load caption data from JSON or TXT files in the captions directory
    
    Args:
        captions_dir (str): Path to directory containing caption files
        
    Returns:
        dict: Dictionary mapping video ID to caption text
    """
    captions = {}
    for filename in os.listdir(captions_dir):
        if filename.endswith(('.json', '.txt')):
            filepath = os.path.join(captions_dir, filename)
            video_id = os.path.splitext(filename)[0]
            
            # Remove _caption or _frame suffix if present
            for suffix in ['_caption', '_frame']:
                if video_id.endswith(suffix):
                    video_id = video_id[:-len(suffix)]
                    break
            
            # Handle JSON files
            if filename.endswith('.json'):
                try:
                    with open(filepath, 'r') as f:
                        data = json.load(f)
                        captions[video_id] = data.get('text', '')
                except json.JSONDecodeError:
                    print(f"Error decoding JSON from {filepath}")
            
            # Handle TXT files
            elif filename.endswith('.txt'):
                try:
                    with open(filepath, 'r') as f:
                        text = f.read().strip()
                        captions[video_id] = text
                except Exception as e:
                    print(f"Error reading text file {filepath}: {e}")
    
    return captions

def store_reels_in_db(videos_dir, cropped_dir, captions_dir):
    """
    Store processed Instagram reels in the database
    
    Args:
        videos_dir (str): Directory containing original videos
        cropped_dir (str): Directory containing cropped videos
        captions_dir (str): Directory containing caption data
        
    Returns:
        int: Number of reels stored
    """
    # Initialize the database connection
    DatabaseManager.initialize()
    
    # Load captions
    captions = load_captions(captions_dir)
    
    # Get absolute path of the cropped directory
    abs_cropped_dir = os.path.abspath(cropped_dir)
    
    count = 0
    # Process each cropped video
    for filename in os.listdir(cropped_dir):
        if filename.endswith('.mp4'):
            video_id = os.path.splitext(filename)[0]
            
            # Get the caption for this video
            caption_text = captions.get(video_id, '')
            
            # Construct absolute path to the cropped video
            video_path = os.path.join(abs_cropped_dir, filename)
            
            # Construct the original URL (if available)
            # For simplicity, we're assuming the video_id is part of the URL
            url = f"https://www.instagram.com/reel/{video_id}/"
            
            # Store in database
            try:
                DatabaseManager.store_reel(url, caption_text, video_path)
                count += 1
                print(f"Stored reel: {video_id} with absolute path")
            except Exception as e:
                print(f"Error storing reel {video_id}: {e}")
    
    # Close database connections
    DatabaseManager.close_all_connections()
    return count

def main():
    parser = argparse.ArgumentParser(description='Store processed Instagram reels in the database')
    parser.add_argument('--videos', default='videos', help='Directory containing original videos')
    parser.add_argument('--cropped', default='cropped', help='Directory containing cropped videos')
    parser.add_argument('--captions', default='captions', help='Directory containing caption data')
    
    args = parser.parse_args()
    
    print(f"Starting to store reels from {args.cropped} with captions from {args.captions}")
    
    count = store_reels_in_db(args.videos, args.cropped, args.captions)
    
    print(f"Successfully stored {count} reels in the database")

if __name__ == "__main__":
    main() 