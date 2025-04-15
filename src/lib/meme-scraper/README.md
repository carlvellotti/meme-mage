# Instagram Meme Scraper

A tool for extracting, processing, and storing Instagram meme videos in a structured database.

## Features

- Download Instagram Reels from URLs
- Extract representative frames from videos
- Detect and crop video content, removing captions and borders
- Intelligent content detection for both light and dark background memes
- Extract caption text using Google Cloud Vision API
- Handle multi-line captions effectively
- Store meme data in a searchable PostgreSQL database
- Process new URLs through the entire pipeline with a single command
- Batch process URLs from a text file

## Installation

1. Clone this repository
2. Set up Google Cloud Vision API:
   - Create a project in Google Cloud Console
   - Enable the Vision API
   - Generate an API key
   - Set the API key in `caption_extractor.py`
3. Set up PostgreSQL database:
   - Install PostgreSQL locally or use a cloud service
   - Create a database called `instagram_memes`
   - Create the required table using:
     ```sql
     CREATE TABLE instagram_reels (
         id SERIAL PRIMARY KEY,
         url TEXT,
         caption_text TEXT,
         video_path TEXT
     );
     ```
4. Install the required Python dependencies:

```bash
pip install -r requirements.txt
```

## Usage

### Individual Component Usage

#### 1. Download Videos

```bash
python downloader.py "https://www.instagram.com/reel/VIDEO_ID1/" "https://www.instagram.com/reel/VIDEO_ID2/"
```

Options:
- `-o, --output-dir`: Directory to save videos (default: "videos")

#### 2. Extract Frames

```bash
python frame_extractor.py
```

Options:
- `--videos`: Directory containing videos (default: "videos")
- `--output`: Directory to save frames (default: "frames")
- `--time-offset`: Time offset in seconds for frame extraction (default: 0)

#### 3. Crop Videos

```bash
python video_cropper.py
```

Options:
- `--videos`: Directory containing videos (default: "videos")
- `--frames`: Directory containing extracted frames (default: "frames")
- `--output`: Directory to save cropped videos (default: "cropped")
- `--single`: Process a single video file

#### 4. Extract Captions

```bash
python caption_extractor.py
```

Options:
- `--frames`: Directory containing extracted frames (default: "frames")
- `--output`: Directory to save captions (default: "captions")
- `--single`: Process a single frame file

#### 5. Store in Database

```bash
python store_memes.py
```

Options:
- `--videos`: Directory containing original videos (default: "videos")
- `--cropped`: Directory containing cropped videos (default: "cropped")
- `--captions`: Directory containing captions (default: "captions")

### Unified Pipeline

#### Process New URLs

To process new Instagram Reels URLs through the entire pipeline in one command:

```bash
python process_reels.py "https://www.instagram.com/reel/VIDEO_ID1/" "https://www.instagram.com/reel/VIDEO_ID2/"
```

Options:
- `--videos-dir`: Directory to save videos (default: "videos")
- `--frames-dir`: Directory to save frames (default: "frames")
- `--cropped-dir`: Directory to save cropped videos (default: "cropped")
- `--captions-dir`: Directory to save captions (default: "captions")
- `--time-offset`: Time offset in seconds for frame extraction (default: 1.0)

This parameter is useful for videos that start with a black screen or fade-in animation. The default of 1.0 seconds helps to capture a frame with visible content.

#### Process URLs from a Text File

To process multiple Instagram Reels URLs from a text file (one URL per line):

```bash
python process_reels.py --url-file path/to/urls.txt
```

Example text file format:
```
https://www.instagram.com/reels/VIDEO_ID1/
https://www.instagram.com/reels/VIDEO_ID2/
https://www.instagram.com/reels/VIDEO_ID3/
```

The same options available for direct URL processing also apply when using a URL file.

#### Process Existing Videos

To process videos that you already have downloaded:

```bash
python test_process.py videos/VIDEO_ID.mp4
```

Options:
- `--frames-dir`: Directory to save frames (default: "frames")
- `--cropped-dir`: Directory to save cropped videos (default: "cropped")
- `--captions-dir`: Directory to save captions (default: "captions")

## Advanced Features

### Intelligent Content Detection

The video cropper uses multiple processing techniques to handle different types of Instagram memes:

- **Brightness Detection**: Automatically detects if the meme has a light or dark background
- **Adaptive Thresholding**: Uses different approaches based on the background type
- **Edge Detection**: Finds content boundaries for difficult cases
- **Fallback Methods**: Ensures reliable cropping even for unusual layouts

This robust approach handles a wide variety of Instagram meme formats including:
- Traditional dark-background memes with white text
- Light-background memes with dark text
- Various caption placements and sizes

## Database Management

The database component provides these functions:
- Store processed reels with associated captions
- Retrieve reels by ID or search by caption text
- Connection pooling for efficient database operations

## Workflow

You can either:

1. Run the entire pipeline at once:
   ```bash
   # Process URLs directly
   python process_reels.py "URL1" "URL2" "URL3"
   
   # Process URLs from a file
   python process_reels.py --url-file urls.txt
   ```

2. Run each step individually:
   ```bash
   python downloader.py "URL1" "URL2" "URL3"
   python frame_extractor.py
   python video_cropper.py
   python caption_extractor.py
   python store_memes.py
   ```

## Requirements

- Python 3.7+
- FFmpeg
- yt-dlp
- OpenCV
- Google Cloud Vision API
- Pillow
- PostgreSQL
- psycopg2