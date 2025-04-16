# Instagram Meme Scraper - Product Requirements Document

## Overview
The Instagram Meme Scraper is a tool designed to extract and process Instagram Reels for building a meme database. The system downloads videos, isolates the primary video content (removing captions and borders), extracts caption text, and stores all components in a structured database for easy retrieval and analysis.

## Goals
- Automate the collection of Instagram meme videos
- Extract and separate video content from text captions
- Create a searchable database of memes with their associated captions
- Handle variations in video formats and sizes automatically

## System Components

### 1. Video Acquisition
- Download Instagram Reels using their URLs
- Store videos locally with consistent naming 
- Manage a collection of video sources for batch processing

### 2. Frame Extraction
- Capture representative frames from each video
- Ensure captured frames include both video content and caption text
- Organize frames for further processing

### 3. Content Isolation
- Dynamically identify the video content region within each frame
- Remove borders, captions, and extraneous elements 
- Generate clean videos containing only the primary content

### 4. Caption Extraction
- Detect and extract text captions from the original frames using Google Cloud Vision API
- Process text to handle multi-line captions and ensure accuracy
- Use dynamic region selection with fallback processing for better text recognition
- Handle various text formats, positions, and multi-line captions efficiently

### 5. Data Management
- Store all components (URL, caption text, video paths) in a database
- Enable efficient retrieval and searching of meme content
- Create relationships between captions and video content

## Workflow
1. User provides Instagram Reel URLs
2. System downloads videos and processes them through all components
3. Database is populated with structured meme data
4. User can query the database to find memes by caption or other attributes

## Success Criteria
- Accurately extract video content from at least 95% of Instagram Reels
- Correctly capture caption text with minimal errors, including multi-line captions
- Process videos of varying dimensions and formats consistently
- Store all components in an organized, queryable database structure

## Future Enhancements
- Implement validation for cropped videos to check for residual text
- Add support for handling animated captions
- Develop a user interface for browsing the meme database
- Add classification and tagging capabilities for better organization 