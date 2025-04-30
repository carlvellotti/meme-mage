import os
import logging
import tempfile
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv
import sys
# Imports moved from hasher.py
import requests
import pathlib
import typing as t
import json

# --- vPDQ Signal Import --- 
# Import necessary ThreatExchange components for video processing
try:
    from threatexchange.extensions.vpdq.vpdq import VPDQSignal
except ImportError as e:
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s') # Configure logging to see this error
    logging.exception("Failed to import VPDQSignal from ThreatExchange. Is it installed correctly (incl. C++ deps)?", e)
    VPDQSignal = None 
    # Allow script to continue to report env/db issues, but hashing will fail.

# --- Logging & Config --- 
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Environment & Configuration --- 
# Explicitly load .env.local from the expected current working directory (project root)
dotenv_filename = ".env.local" # Use .env.local
dotenv_path = os.path.join(os.getcwd(), dotenv_filename) 
logging.info(f"Attempting to load environment variables from: {dotenv_path}")
found_dotenv = load_dotenv(dotenv_path=dotenv_path)

if not found_dotenv:
    logging.warning(f"Could not find {dotenv_filename} file at expected location: {dotenv_path}. Trying default load_dotenv().")
    # Attempt default load_dotenv() as fallback (which looks for .env or .flaskenv)
    load_dotenv() 

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
# Add check after attempting to load
if not SUPABASE_URL or not SUPABASE_KEY:
    logging.error("Supabase URL or Key STILL not found after attempting to load from .env / .env.local")
    # Decide if we should exit here, maybe Supabase connection will fail anyway
    # sys.exit(1)

PROCESSING_BATCH_SIZE = int(os.environ.get("VPDQ_BATCH_SIZE", 5))
# Hashing Config
HASH_QUALITY_THRESHOLD = int(os.environ.get("VPDQ_QUALITY_THRESHOLD", 90))
HASH_SUBSAMPLING_RATE = int(os.environ.get("VPDQ_SUBSAMPLING_RATE", 6)) # Keep every Nth high-quality frame

# --- Functions moved from hasher.py --- 

def download_video(url: str, temp_dir: str) -> str | None:
    """Downloads video from URL to a temporary file."""
    try:
        headers = {'User-Agent': 'MEME_BOT/1.0 VideoProcessor'}
        response = requests.get(url, stream=True, timeout=60, headers=headers)
        response.raise_for_status()
        content_type = response.headers.get('content-type', '').lower()
        if content_type and not content_type.startswith('video/'):
             logging.warning(f"Content-type for {url} is '{content_type}', not 'video/*'. Attempting download anyway.")
        suffix = '.mp4'
        if 'video/webm' in content_type: suffix = '.webm'
        elif 'video/quicktime' in content_type: suffix = '.mov'
        elif 'video/avi' in content_type: suffix = '.avi'
        fd, temp_path = tempfile.mkstemp(suffix=suffix, dir=temp_dir)
        logging.info(f"Downloading video from {url} to {temp_path}")
        downloaded_bytes = 0
        with os.fdopen(fd, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                downloaded_bytes += len(chunk)
        if downloaded_bytes == 0:
             logging.warning(f"Downloaded 0 bytes from {url}.")
             try: os.remove(temp_path)
             except OSError: pass
             return None
        logging.info(f"Finished downloading {temp_path} ({downloaded_bytes} bytes)")
        return temp_path
    except requests.exceptions.RequestException as e:
        logging.error(f"Failed to download video {url}: {e}")
        return None
    except Exception as e:
         logging.error(f"Error during video download {url}: {e}")
         if 'temp_path' in locals() and os.path.exists(temp_path):
             try: os.remove(temp_path)
             except OSError: pass
         return None

def generate_vpdq_hashes(video_path: str, seconds_per_hash: float = 1.0) -> t.List[t.Dict[str, t.Any]] | None:
    """Generates vPDQ hashes, filters by quality, and subsamples."""
    if VPDQSignal is None:
        logging.error("VPDQSignal unavailable. Cannot generate hash.")
        return None
    if not os.path.exists(video_path):
        logging.error(f"Video file not found: {video_path}")
        return None
    file_size = os.path.getsize(video_path)
    if file_size < 1024: # Basic check for obviously bad files
        logging.warning(f"Video file size is very small ({file_size} bytes): {video_path}")
        # Potentially return None or empty list depending on desired handling
        # return None 

    try:
        logging.info(f"Generating raw vPDQ hashes for {video_path} (sampling every {seconds_per_hash}s)")
        # Call the library function - ASSUMING it returns the JSON string
        raw_output_string = VPDQSignal.hash_from_file(pathlib.Path(video_path), seconds_per_hash=seconds_per_hash)

        if not isinstance(raw_output_string, str) or not raw_output_string.strip():
            logging.error(f"VPDQSignal.hash_from_file did not return a non-empty string. Type: {type(raw_output_string)}")
            return None
        
        # Parse the JSON string into a list of objects
        try:
            raw_frames = json.loads(raw_output_string)
            if not isinstance(raw_frames, list):
                logging.error(f"Parsed vPDQ output is not a list. Type: {type(raw_frames)}. Output: {raw_output_string[:200]}...")
                return None
        except json.JSONDecodeError as json_err:
            logging.error(f"Failed to parse vPDQ output string as JSON. Error: {json_err}. Output: {raw_output_string[:200]}...")
            return None

        if not raw_frames:
            logging.warning(f"vPDQ hashing produced an empty list for {video_path}.")
            return [] # Return empty list for valid but empty results

        # --- Filtering and Subsampling --- 
        filtered_frames = []
        for frame in raw_frames:
            # Validate frame object structure
            if isinstance(frame, dict) and all(k in frame for k in ('pdq_hash', 'quality', 'timestamp')):
                if frame.get('quality', 0) >= HASH_QUALITY_THRESHOLD:
                    filtered_frames.append(frame)
            else:
                logging.warning(f"Skipping invalid frame object: {frame}")
        
        logging.info(f"Kept {len(filtered_frames)} frames out of {len(raw_frames)} after quality filtering (>= {HASH_QUALITY_THRESHOLD}).")

        if not filtered_frames:
            return [] # Return empty if no high-quality frames

        # Subsample
        if HASH_SUBSAMPLING_RATE > 1:
            subsampled_frames = filtered_frames[::HASH_SUBSAMPLING_RATE]
            logging.info(f"Kept {len(subsampled_frames)} frames after subsampling (rate: {HASH_SUBSAMPLING_RATE}).")
        else:
            subsampled_frames = filtered_frames # No subsampling if rate is 1 or less
            logging.info("Subsampling rate <= 1, keeping all filtered frames.")

        # Optional: Further validation on subsampled_frames if needed

        logging.info(f"Successfully generated and processed {len(subsampled_frames)} vPDQ frame objects for {video_path}")
        return subsampled_frames

    except Exception as e:
        logging.exception(f"Failed during vPDQ hash generation/processing for {video_path}: {e}")
        return None

# --- Main Application Logic --- 

def initialize_supabase() -> Client | None:
    """Initializes and returns the Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        logging.error("Supabase URL or Key not found in environment variables.")
        return None
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logging.info("Supabase client initialized successfully.")
        return supabase
    except Exception as e:
        logging.exception("Failed to initialize Supabase client.")
        return None

def lock_and_fetch_batch(supabase: Client) -> list:
    """
    Attempts to lock and fetch a batch of templates for processing.

    NOTE: This Python-based locking is NOT guaranteed to be atomic under high
    concurrency. A database function using UPDATE...RETURNING is safer.
    """
    locked_templates = []
    timestamp_now = datetime.now(timezone.utc).isoformat()

    try:
        # Step 1: Select potential candidates
        select_response = (supabase.table('meme_templates')
            .select('id')
            .is_('vpdq_frame_hashes', None)
            .is_('video_processing_started_at', None)
            .not_.is_('source_video_url', None)
            .limit(PROCESSING_BATCH_SIZE)
            .execute())

        if not select_response.data:
            logging.info("No candidate videos found needing processing.")
            return []

        candidate_ids = [t['id'] for t in select_response.data]
        logging.info(f"Found {len(candidate_ids)} potential candidates.")

        # Step 2: Attempt to acquire lock
        update_response = (supabase.table('meme_templates')
            .update({'video_processing_started_at': timestamp_now})
            .in_('id', candidate_ids)
            .is_('video_processing_started_at', None)
            .execute())

        logging.debug(f"Locking update response data: {update_response.data}") # Likely empty list

        # Step 3: Re-fetch the rows we hope we locked successfully
        # If the timestamp matches, we likely got the lock.
        fetch_locked_response = (supabase.table('meme_templates')
           .select('id, source_video_url')
           .in_('id', candidate_ids)
           .eq('video_processing_started_at', timestamp_now)
           .execute())

        if fetch_locked_response.data:
            locked_templates = fetch_locked_response.data
            logging.info(f"Successfully locked {len(locked_templates)} videos for processing.")
        else:
            logging.info("No videos were successfully locked in this attempt (possibly locked by another process).")

    except Exception as e:
        logging.exception(f"Error during locking/fetching batch: {e}")
        # Locked rows might remain locked on error. Requires monitoring/cleanup.

    return locked_templates

def process_video(template_id: str, video_url: str, temp_dir: str) -> tuple[list | None, str | None]:
    """Downloads, generates filtered/subsampled vPDQ hashes, and cleans up."""
    local_video_path = None
    vpdq_frame_objects = None # Expect list[dict] after filtering
    error_message = None
    try:
        local_video_path = download_video(video_url, temp_dir) # Access via module
        if local_video_path:
            # generate_vpdq_hashes should return filtered list[dict] or None
            vpdq_frame_objects = generate_vpdq_hashes(local_video_path) # Access via module
            if vpdq_frame_objects is None:
                 error_message = "vPDQ hash generation returned None (check logs)."
            elif not vpdq_frame_objects: # Handle empty list result
                 error_message = "vPDQ hash generation resulted in zero frames after filtering."
        else:
            error_message = "Video download failed."
    except Exception as e:
        logging.exception(f"Unhandled error processing {template_id}: {e}")
        error_message = str(e)
    finally:
        # Ensure temporary file cleanup
        if local_video_path and os.path.exists(local_video_path):
            try:
                os.remove(local_video_path)
                logging.debug(f"Removed temporary file: {local_video_path}")
            except OSError as e:
                 logging.warning(f"Could not remove temp file {local_video_path}: {e}")
    return vpdq_frame_objects, error_message

def update_template_status(supabase: Client, template_id: str, vpdq_hashes: list | None, error_message: str | None):
    """Updates the database record, clearing the lock."""
    update_data = {
        'video_processed_at': datetime.now(timezone.utc).isoformat() if vpdq_hashes is not None else None,
        'video_processing_error': error_message,
        'vpdq_frame_hashes': vpdq_hashes, # Store list[dict] (or None)
        'video_processing_started_at': None # Clear the lock
    }

    try:
        update_response = (supabase.table('meme_templates')
            .update(update_data)
            .eq('id', template_id)
            .execute())
        # Check count if available, otherwise log optimistically
        # logging.debug(f"DB final update response count for {template_id}: {update_response.count}")
        logging.info(f"Attempted final status update for template {template_id}.")
    except Exception as db_error:
        logging.exception(f"Failed to update database status for template {template_id}: {db_error}")
        # If this fails, the lock remains set! Requires manual intervention.

def main():
    """Main processing loop."""
    logging.info("Starting vPDQ processor.")
    supabase = initialize_supabase()
    if not supabase:
        sys.exit(1) # Exit if DB connection fails

    locked_templates = lock_and_fetch_batch(supabase)
    if not locked_templates:
        logging.info("No templates to process in this run.")
        return

    processed_count = 0
    failed_count = 0

    # Use a single temp directory for the entire batch run
    with tempfile.TemporaryDirectory(prefix="vpdq_proc_") as tmpdir:
        logging.info(f"Using temporary directory: {tmpdir}")
        for template in locked_templates:
            template_id = template.get('id')
            video_url = template.get('source_video_url')

            if not template_id or not video_url:
                 logging.warning(f"Skipping template due to missing ID or URL: {template}")
                 # Should we attempt to clear the lock for invalid records? Maybe not here.
                 failed_count += 1
                 continue

            logging.info(f"Processing template ID: {template_id}, URL: {video_url}")
            vpdq_hashes, error_msg = process_video(template_id, video_url, tmpdir)

            # Update status regardless of success/failure to clear the lock
            update_template_status(supabase, template_id, vpdq_hashes, error_msg)

            if vpdq_hashes is not None and error_msg is None:
                processed_count += 1
            else:
                failed_count += 1
                logging.error(f"Failed processing for template {template_id}: {error_msg}")


    logging.info(f"vPDQ Batch finished. Successfully processed: {processed_count}, Failed: {failed_count}")

if __name__ == '__main__':
    main()