# Instagram Meme Scraper User Manual

This document provides detailed instructions for using the Instagram Meme Scraper tool to download, process, and store Instagram Reels in a structured database.

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Basic Usage](#basic-usage)
   - [Processing a Single URL](#processing-a-single-url)
   - [Processing Multiple URLs](#processing-multiple-urls) 
   - [Processing URLs from a Text File](#processing-urls-from-a-text-file)
4. [Advanced Options](#advanced-options)
5. [Troubleshooting](#troubleshooting)

## Introduction

The Instagram Meme Scraper is a tool designed to:
- Download videos from Instagram Reels
- Extract the primary video content (removing borders and captions)
- Extract caption text from the video
- Store everything in a database for easy retrieval

This is especially useful for building a collection of meme videos and making them searchable by their captions.

## Installation

### Prerequisites

- Python 3.7 or higher
- FFmpeg installed and available in your PATH
- PostgreSQL database server
- Google Cloud account with Vision API enabled

### Step 1: Clone the Repository

```bash
git clone https://github.com/youruser/meme-scraper.git
cd meme-scraper
```

### Step 2: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 3: Set Up Google Cloud Vision API

1. Create a project in Google Cloud Console
2. Enable the Vision API
3. Generate an API key
4. Add the API key to `caption_extractor.py`

### Step 4: Set Up PostgreSQL Database

1. Install PostgreSQL if not already installed
2. Create a database called `instagram_memes`:
   ```sql
   CREATE DATABASE instagram_memes;
   ```
3. Connect to the database and create the required table:
   ```sql
   CREATE TABLE instagram_reels (
       id SERIAL PRIMARY KEY,
       url TEXT,
       caption_text TEXT,
       video_path TEXT
   );
   ```
4. Configure the database connection in `db_manager.py`

## Basic Usage

The tool provides three main ways to process Instagram Reels:

### Processing a Single URL

To process a single Instagram Reel URL:

```bash
python process_reels.py "https://www.instagram.com/reels/VIDEO_ID/"
```

Example:
```bash
python process_reels.py "https://www.instagram.com/reels/CqW9XYZabcd/"
```

This will:
1. Download the video from the provided URL
2. Extract a frame at 1.0 seconds into the video
3. Detect and crop the main video content
4. Extract the caption text using OCR
5. Store all data in the database
6. Output the processing results to the console

### Processing Multiple URLs

To process multiple Instagram Reel URLs at once:

```bash
python process_reels.py "URL1" "URL2" "URL3" ...
```

Example:
```bash
python process_reels.py "https://www.instagram.com/reels/CqW9XYZabcd/" "https://www.instagram.com/reels/DrT5UVWxyz/"
```

Each URL will be processed sequentially, and the results for each will be displayed.

### Processing URLs from a Text File

For bulk processing, you can create a text file with one URL per line:

1. Create a text file (e.g., `urls.txt`) with the following format:
   ```
   https://www.instagram.com/reels/CqW9XYZabcd/
   https://www.instagram.com/reels/DrT5UVWxyz/
   https://www.instagram.com/reels/Es7FGHijkl/
   ```

2. Process all URLs in the file:
   ```bash
   python process_reels.py --url-file urls.txt
   ```

This is the most efficient way to process a large number of URLs.

## Advanced Options

The `process_reels.py` script accepts several optional parameters:

```bash
python process_reels.py [URLs...] [OPTIONS]
```

Available options:

- `--url-file PATH`: Process URLs from a text file
- `--videos-dir DIR`: Directory to save downloaded videos (default: "videos")
- `--frames-dir DIR`: Directory to save extracted frames (default: "frames")
- `--cropped-dir DIR`: Directory to save cropped videos (default: "cropped")
- `--captions-dir DIR`: Directory to save caption data (default: "captions")
- `--time-offset SEC`: Time offset in seconds for frame extraction (default: 1.0)

Example with options:
```bash
python process_reels.py --url-file urls.txt --videos-dir my_videos --time-offset 2.5
```

This will:
- Process all URLs in `urls.txt`
- Save downloaded videos in the `my_videos` directory
- Extract frames at 2.5 seconds into each video

## Troubleshooting

### Common Issues

1. **Video Download Fails**
   - Make sure the Instagram Reel URL is valid and accessible
   - Check your internet connection
   - Verify that yt-dlp is properly installed

2. **Frame Extraction Fails**
   - Ensure FFmpeg is installed and available in your PATH
   - Check if the downloaded video file exists and is not corrupted

3. **Video Cropping Issues**
   - If many videos are being incorrectly cropped, try adjusting the `--time-offset` parameter to capture a better frame

4. **Caption Extraction Issues**
   - Verify your Google Cloud Vision API key is correctly set up
   - Check the extracted frame to see if caption text is clearly visible

5. **Database Connection Errors**
   - Verify PostgreSQL is running
   - Check the database connection details in `db_manager.py`

### Getting Help

If you encounter problems not covered in this manual:

1. Check the debug logs in the console output
2. Examine the intermediate files in the output directories
3. If a specific URL is problematic, try processing it individually
4. For persistent issues, open an issue on the GitHub repository 