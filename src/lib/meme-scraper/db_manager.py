import os
from supabase import create_client, Client
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('db_manager')

# Initialize Supabase client
supabase: Client | None = None
try:
    url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    # Use Service Role Key for backend operations
    key: str = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        logger.error("FATAL: Supabase URL or Service Key environment variables not set.")
        # Optionally exit if running as main script, or raise if imported
        # sys.exit(1) 
        raise ValueError("Supabase credentials missing in environment.")
    
    supabase = create_client(url, key)
    logger.info("Supabase client initialized successfully.")

except Exception as e:
    logger.error(f"FATAL: Failed to initialize Supabase client: {e}")
    # Optionally exit or raise
    # sys.exit(1)
    supabase = None # Ensure supabase is None if init fails

def check_client():
    """Checks if the Supabase client is initialized."""
    if supabase is None:
        logger.error("Supabase client is not initialized. Cannot perform database operations.")
        return False
    return True

def insert_pending_reel(instagram_url):
    """Inserts a new row for a reel with status 'pending' using Supabase client and returns its UUID."""
    if not check_client():
        return None

    try:
        data_to_insert = {
            "instagram_url": instagram_url,
            "status": "processing"  # Start as processing now
        }
        logger.info(f"Inserting into unprocessed_templates: {data_to_insert}")
        response = supabase.table("unprocessed_templates").insert(data_to_insert).execute()

        # Check if insertion was successful and data is returned
        if response.data and len(response.data) > 0:
            reel_id = response.data[0]['id']
            logger.info(f"Successfully inserted pending reel with ID: {reel_id}")
            return reel_id
        else:
            logger.error(f"Supabase insert failed or returned no data. Response: {response}")
            return None
            
    except Exception as e:
        logger.error(f"Error inserting pending reel via Supabase: {e}")
        return None

def update_template_urls(template_id, cropped_video_url=None, thumbnail_url=None,
                          caption_text=None, status=None, error_message=None):
    """Updates an unprocessed template record using Supabase client."""
    if not check_client() or not template_id:
        return False

    update_data = {}
    if cropped_video_url is not None:
        update_data["cropped_video_url"] = cropped_video_url
    if thumbnail_url is not None:
        update_data["thumbnail_url"] = thumbnail_url
    if caption_text is not None:
        update_data["caption_text"] = caption_text
    if status is not None:
        update_data["status"] = status
    if error_message is not None:
        # Ensure error messages don't exceed potential column limits (optional)
        update_data["error_message"] = str(error_message)[:1000] # Example limit
    else:
        # Explicitly set error_message to None if status is not 'failed'
        if status and status != 'failed':
             update_data["error_message"] = None

    if not update_data:
        logger.warning("No fields provided to update_template_urls")
        return False

    try:
        logger.info(f"Updating unprocessed_templates ID {template_id} with: {update_data}")
        response = supabase.table("unprocessed_templates")\
                         .update(update_data)\
                         .eq("id", template_id)\
                         .execute()

        # Check if update was successful
        if response.data and len(response.data) > 0:
            logger.info(f"Successfully updated template ID: {template_id}")
            return True
        elif hasattr(response, 'status_code') and 200 <= response.status_code < 300:
             # Handle cases where update affects rows but API might not return data list (check newer supabase-py versions)
             logger.info(f"Successfully updated template ID: {template_id} (Status code: {response.status_code})")
             return True
        else:
            # Log the full response if possible for debugging
            try:
                response_details = response.model_dump_json() # pydantic v2
            except AttributeError:
                response_details = str(response)
            logger.error(f"Supabase update failed for ID {template_id}. Response: {response_details}")
            return False

    except Exception as e:
        logger.error(f"Error updating template ID {template_id} via Supabase: {e}")
        return False

def update_template_status(template_id, status, error_message=None):
    """Updates just the status and optionally the error message of a template."""
    return update_template_urls(template_id, status=status, error_message=error_message)

def update_template_error(template_id, error_message):
    """Marks a template as failed with an error message."""
    return update_template_urls(template_id, status='failed', error_message=error_message)

# Example usage (optional, for direct testing of this module)
if __name__ == '__main__':
    print("Testing db_manager with Supabase client...")
    # Load .env for local testing if needed
    # from dotenv import load_dotenv
    # load_dotenv(dotenv_path='../.env.local') # Adjust path

    if check_client():
        print("Client seems initialized.")
        # Test insert
        test_url = "https://example.com/reel/test12345"
        print(f"Attempting to insert: {test_url}")
        new_id = insert_pending_reel(test_url)

        if new_id:
            print(f"Insert successful, ID: {new_id}")
            # Test update
            time.sleep(1) # Small delay
            print("Attempting to update status to completed...")
            update_success = update_template_status(new_id, 'completed')
            print(f"Update status success: {update_success}")
            
            time.sleep(1)
            print("Attempting to update with URLs...")
            update_success_2 = update_template_urls(
                new_id,
                cropped_video_url="https://example.com/video.mp4",
                thumbnail_url="https://example.com/thumb.jpg",
                caption_text="Test caption"
            )
            print(f"Update URLs success: {update_success_2}")

            time.sleep(1)
            print("Attempting to mark as failed...")
            update_fail_success = update_template_error(new_id, "This is a test error.")
            print(f"Update to failed status success: {update_fail_success}")
            
            # Clean up test record (optional)
            # print("Attempting cleanup...")
            # try:
            #     cleanup_response = supabase.table("unprocessed_templates").delete().eq("id", new_id).execute()
            #     print(f"Cleanup response: {cleanup_response}")
            # except Exception as ce:
            #     print(f"Cleanup error: {ce}")

        else:
            print("Insert failed.")
    else:
        print("Supabase client not initialized, cannot run tests.") 