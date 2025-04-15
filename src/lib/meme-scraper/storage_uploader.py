# storage_uploader.py
import os
import mimetypes
import httpx
import magic  # For MIME type detection
from urllib.parse import urljoin, quote
import json

class StorageUploader:
    def __init__(self):
        # Get Supabase credentials from environment
        self.supabase_url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
        
        # Try both possible service key environment variable names
        self.supabase_key = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

        if not self.supabase_url:
            raise ValueError("NEXT_PUBLIC_SUPABASE_URL environment variable not found. Ensure it is set.")
            
        if not self.supabase_key:
            raise ValueError("Neither SUPABASE_SERVICE_KEY nor SUPABASE_SERVICE_ROLE_KEY environment variable found. Ensure one is set.")

        # Ensure URL ends with '/'
        if not self.supabase_url.endswith('/'):
            self.supabase_url += '/'

        # Storage API endpoint
        self.storage_url = urljoin(self.supabase_url, 'storage/v1/object/')
        
        print(f"Initialized StorageUploader with URL: {self.supabase_url}")
        print(f"Using service key starting with: {self.supabase_key[:10]}..." if self.supabase_key else "No service key found!")

    def get_content_type(self, file_path):
        """Determine content type of a file using python-magic and fallback to mimetypes"""
        try:
            mime = magic.Magic(mime=True)
            content_type = mime.from_file(file_path)
            print(f"Detected MIME type (magic): {content_type} for {file_path}")
            return content_type
        except Exception as e:
            print(f"Error using python-magic: {e}. Falling back to mimetypes.")
            content_type, _ = mimetypes.guess_type(file_path)
            print(f"Detected MIME type (mimetypes): {content_type} for {file_path}")
            return content_type or 'application/octet-stream' # Default if guess fails

    def upload_file(self, file_path, bucket_name, destination_path=None):
        """
        Upload a file to Supabase Storage

        Args:
            file_path: Local path to the file
            bucket_name: Name of the Supabase bucket
            destination_path: Path within the bucket (if None, use filename)

        Returns:
            Tuple: (success, public_url or error message)
        """
        if not os.path.exists(file_path):
            error_msg = f"File not found: {file_path}"
            print(f"[StorageUploader Error] {error_msg}")
            return False, error_msg

        # Get filename if destination_path not provided
        if not destination_path:
            destination_path = os.path.basename(file_path)

        # URL encode the path, ensuring bucket name is part of the encoded path
        # Example: unprocessed-videos/my_video.mp4 -> unprocessed-videos/my_video.mp4 (if no special chars)
        # Example: unprocessed-videos/my video&.mp4 -> unprocessed-videos/my%20video%26.mp4
        encoded_path_segment = quote(destination_path)
        full_storage_path = f"{bucket_name}/{encoded_path_segment}"
        upload_url = urljoin(self.storage_url, full_storage_path)
        print(f"Attempting upload to URL: {upload_url}")


        # Get file content type
        content_type = self.get_content_type(file_path)

        headers = {
            'Authorization': f'Bearer {self.supabase_key}',
            'Content-Type': content_type,
            # Include cache-control for videos/images
            'Cache-Control': 'max-age=3600',
            # 'x-upsert': 'true' # Consider adding if overwriting is desired/needed
        }
        print(f"Using headers: {headers}")

        try:
            with open(file_path, 'rb') as f:
                file_content = f.read()
                print(f"Read {len(file_content)} bytes from {file_path}")

                # Use httpx context manager for better resource handling
                with httpx.Client() as client:
                    response = client.post(
                        upload_url,
                        headers=headers,
                        content=file_content,
                        timeout=120.0  # Increased timeout for potentially large video uploads
                    )

            print(f"Upload response status code: {response.status_code}")
            # print(f"Upload response headers: {response.headers}")
            # print(f"Upload response body: {response.text}")


            if response.status_code == 200:
                # Construct the public URL correctly
                public_url_base = urljoin(self.supabase_url, f'storage/v1/object/public/{bucket_name}/')
                public_url = urljoin(public_url_base, encoded_path_segment)

                print(f"Upload successful. Public URL: {public_url}")
                return True, public_url
            else:
                error_msg = f"Upload failed for {destination_path} with status {response.status_code}: {response.text}"
                print(f"[StorageUploader Error] {error_msg}")
                return False, error_msg

        except httpx.RequestError as e:
            error_msg = f"HTTP request error during upload for {destination_path}: {str(e)}"
            print(f"[StorageUploader Error] {error_msg}")
            return False, error_msg
        except Exception as e:
            error_msg = f"General error during upload for {destination_path}: {str(e)}"
            print(f"[StorageUploader Error] {error_msg}")
            return False, error_msg

    def upload_thumbnail(self, file_path, unique_id):
        """Upload a thumbnail with a standardized name"""
        _, ext = os.path.splitext(file_path)
        # Generate a unique name based on the unique ID and keep original extension
        filename = f"thumbnail_{unique_id}{ext}"
        print(f"Uploading thumbnail: {file_path} as {filename}")
        return self.upload_file(file_path, 'unprocessed-thumbnails', filename)

    def upload_video(self, file_path, unique_id):
        """Upload a video with a standardized name"""
        _, ext = os.path.splitext(file_path)
         # Generate a unique name based on the unique ID and keep original extension
        filename = f"video_{unique_id}{ext}"
        print(f"Uploading video: {file_path} as {filename}")
        return self.upload_file(file_path, 'unprocessed-videos', filename) 