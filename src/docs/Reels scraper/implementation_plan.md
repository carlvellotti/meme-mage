# Instagram Reels Scraper Integration: Implementation Plan

## Overview

This document outlines the complete implementation plan for integrating the Instagram Reels scraper functionality into the Meme Mage application. The integration is divided into four manageable chunks, each focusing on a specific aspect of the solution.

## Prerequisites

Before beginning implementation, ensure the following prerequisites are met:

1. A working copy of the Python-based Instagram Reels scraper (`meme-scraper copy/`)
2. Access to a Supabase project with permission to create tables and storage buckets
3. Google Cloud Vision API credentials (for caption extraction)
4. Development environment with Node.js, Python 3.7+, and FFmpeg installed
5. Understanding of Next.js App Router and React components

## Implementation Chunks

The integration has been divided into the following chunks:

### [Chunk 1: Backend Setup & Basic Scraping API](./chunk_1_backend_setup.md)

**Focus**: Database schema, Python scraper modifications, and Next.js API route to trigger the scraper.
**Status**: Completed.

**Key Deliverables**: Supabase table (`unprocessed_templates`), Modified Python scraper structure, Next.js API route (`/api/scrape-reels`) for triggering.

**Key Decisions/Notes**: Required Python venv, Fixed relative imports, Encountered direct DB connection issues, Used simulated DB for initial API testing, Actual DB interaction method deferred.

### [Chunk 2: Storage Integration & File Processing](./chunk_2_storage_integration.md)

**Focus**: Supabase Storage integration for file uploads, implementing actual Python processing logic (download, crop, caption), real database updates using `supabase-py`, comprehensive error handling, and testing.
**Status**: Completed.

**Key Deliverables**: Supabase Storage buckets (`unprocessed-videos`, `unprocessed-thumbnails`), Python `StorageUploader` class, `db_manager.py` refactored for `supabase-py`, Full processing pipeline in `process_reels.py` with file uploads and DB updates, Test scripts (`test_env.py`, `test_db.py`, `test_storage.py`, `test_integration.py`), Successful direct execution test.

**Key Decisions/Notes**: Added `httpx`, `python-magic`, `supabase-py`, `python-dotenv`. Required `libmagic` system dependency installation. Resolved `.env` loading for direct script execution using `python-dotenv`. Handled ambiguity between `SUPABASE_SERVICE_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Refactored DB access from `psycopg2` to `supabase-py` due to direct connection restrictions. Successfully tested end-to-end pipeline via direct script execution. **Created and tested the `DELETE /api/unprocessed-templates/[id]` API route needed for Chunk 3.**

### [Chunk 3: Frontend Components](./chunk_3_frontend_components.md)
**Focus**: User interface components for submitting URLs and displaying/selecting unprocessed templates.
**Status**: Completed.

**Key Deliverables**: `ReelScraperForm` component, `UnprocessedTemplatesTable` component (with pagination, video preview), Modifications to `TemplateUploader` (handling selected template data, source URL, deletion).

**Key Decisions/Notes**: Debugged Python execution environment issues (`ModuleNotFoundError`, `proxy` argument error, dependency pinning). Implemented API route synchronization (waits for Python script). Added pagination, video preview modal. Removed status column. Handled `original_source_url` persistence. Allowed duplicate URL reprocessing.

### [Chunk 4: Testing, Deployment & Monitoring](./chunk_4_testing_deployment.md)
**(Planned Last)**

**Focus**: Final testing procedures, deployment configuration, and monitoring systems.

**Key Deliverables**: Test scripts, Deployment configuration, Monitoring dashboard.

## Implementation Timeline

The following is the updated suggested timeline:

1.  **Chunk 1 (Backend Setup & Basic API)**: Completed
2.  **Chunk 2 (Storage & File Processing)**: Completed
3.  **Chunk 3 (Frontend Components)**: Completed (~3-4 days, including debugging)
4.  **Chunk 4 (Testing & Deployment)**: ~2-3 days

**Total Estimated Time**: ~10-14 days (excluding potential delays resolving DB connection methods or external API issues).

## Dependencies and Risks

### Dependencies

1. **External APIs**:
   - Instagram: The scraper relies on the ability to download videos from Instagram
   - Google Cloud Vision: Used for caption extraction
   - Supabase: For database and storage functionality. Requires resolving the optimal connection method from Python (Client Lib/REST API vs. direct connection).

2. **Libraries and Tools**:
   - `yt-dlp`: Used for video downloading (requires regular updates)
   - FFmpeg: Used for video processing
   - OpenCV: Used for image processing and content detection

### Risks

1. **Instagram Changes**:
   - Instagram may change their website structure, affecting download capabilities
   - Mitigation: Regular updates to `yt-dlp` and monitoring for failures

2. **Rate Limiting**:
   - Instagram, Google Cloud, or Supabase may rate-limit requests
   - Mitigation: Implement retry logic and throttling mechanisms

3. **Processing Time**:
   - Video processing may take significant time
   - Mitigation: Asynchronous processing and clear user feedback

4. **Storage Costs**:
   - Videos can consume significant storage
   - Mitigation: Regular cleanup of old temporary files

## Success Criteria

The integration will be considered successful when:

1. Users can submit Instagram Reel URLs and have them processed automatically
2. The system reliably extracts, crops, and stores videos and captions
3. Users can select processed templates for finalization
4. The system provides clear feedback on processing status and errors
5. Administrators can monitor system performance and troubleshoot issues

## Future Enhancements

After the initial implementation, consider the following enhancements:

1. **Queue-Based Architecture**:
   - Implement a message queue for more scalable processing

2. **Batch Processing**:
   - Allow administrators to upload a batch file of URLs

3. **Automatic Content Categorization**:
   - Use AI to categorize templates based on content

4. **Progress Tracking**:
   - Implement real-time progress updates during processing

5. **Enhanced Error Recovery**:
   - Add automatic retries for transient failures
   - Implement partial recovery for multi-step failures 