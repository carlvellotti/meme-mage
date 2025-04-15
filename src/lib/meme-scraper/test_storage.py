#!/usr/bin/env python3
import os
import sys
import tempfile
from pathlib import Path

# Try to import the StorageUploader
try:
    from storage_uploader import StorageUploader
    print("✅ Successfully imported StorageUploader")
except ImportError as e:
    print(f"❌ Failed to import StorageUploader: {e}")
    sys.exit(1)

def create_test_files():
    """Create temporary test files for upload testing."""
    # Create a temp directory
    temp_dir = tempfile.mkdtemp()
    print(f"Created temporary directory: {temp_dir}")
    
    # Create a test image file (small black rectangle)
    test_image_path = os.path.join(temp_dir, "test_thumbnail.jpg")
    with open(test_image_path, "wb") as f:
        # Create a minimal valid JPEG file with a black 10x10 image
        # JPEG header + minimal data
        f.write(bytes.fromhex(
            'FFD8FFE000104A4649460001010100480048000000FFDB004300080606070605080707'
            '07090908080A0C140D0C0B0B0C1912130F141D1A1F1E1D1A1C1C20242E2720222C231C1C2837'
            '292C30313434341F27393D38323C2E333432FFDB0043010909090C0B0C180D0D1832211C2132'
            '323232323232323232323232323232323232323232323232323232323232323232323232323232'
            '32323232323232323232FFC00011080010001003012200021101031101FFC4001F000001050101'
            '0101010100000000000000000102030405060708090A0BFFC400B510000201030302040305050'
            '4040000017D010203000411051221314106135161072271143281A1B1C109233352F0156272D1'
            '0A162434E125F11718191A262728292A35363738393A434445464748494A535455565758595A6'
            '36465666768696A737475767778797A838485868788898A92939495969798999AA2A3A4A5A6A7'
            'A8A9AAB2B3B4B5B6B7B8B9BAC2C3C4C5C6C7C8C9CAD2D3D4D5D6D7D8D9DAE1E2E3E4E5E6E7E8E'
            '9EAF1F2F3F4F5F6F7F8F9FAFFC4001F01000301010101010101010100000000000001020304050'
            '60708090A0BFFC400B5110002010204040304070504040001027700010203110405213106124151'
            '0761711322328108144291A1B1C109233352F0156272D10A16243382F1E2243454627282929A343'
            '5363738393A434445464748494A535455565758595A636465666768696A737475767778797A82838'
            '4858687888898A92939495969798999AA2A3A4A5A6A7A8A9AAB2B3B4B5B6B7B8B9BAC2C3C4C5C6C7'
            'C8C9CAD2D3D4D5D6D7D8D9DAE2E3E4E5E6E7E8E9EAF2F3F4F5F6F7F8F9FAFFDA000C0301000211'
            '0311003F00FFFFFF000000FFFFFFFFFD9'
        ))
    print(f"Created test image file: {test_image_path}")
    
    # Create a test video file (simple MP4)
    test_video_path = os.path.join(temp_dir, "test_video.mp4")
    with open(test_video_path, "wb") as f:
        # Create a minimal valid MP4 file with a black frame
        # MP4 header + minimal data
        f.write(bytes.fromhex(
            '00000018667479706D703432000000006D70343269736F6D0000000C6D6F6F760000000C6D766864'
            '00000000000000000000000F00000000000000000000000000010000000000000000000000000000'
            '00010000000000000000000000000000000000000000000001000000000000000000000000000000'
            '00000000000000000000000000000000000000000000000000018747261636B000000146D646961'
            '0000000C686476640000000000000028766D686400000000000000010000000F0001000000000000'
            '0000001000000000000000'
        ))
    print(f"Created test video file: {test_video_path}")
    
    return temp_dir, test_image_path, test_video_path

def test_storage_uploader():
    """Test the StorageUploader functionality."""
    print("=== Testing Storage Uploader ===")
    
    # First check if required environment variables are set
    supabase_url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    service_key = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not service_key:
        print("❌ Required environment variables are missing.")
        print(f"NEXT_PUBLIC_SUPABASE_URL: {'✅ Set' if supabase_url else '❌ Missing'}")
        print(f"SUPABASE_SERVICE_KEY/ROLE_KEY: {'✅ Set' if service_key else '❌ Missing'}")
        return False
    
    try:
        # Create an instance of StorageUploader
        uploader = StorageUploader()
        print("✅ Successfully created StorageUploader instance")
        
        # Create test files
        temp_dir, test_image_path, test_video_path = create_test_files()
        
        # Test unique identifier
        test_id = "test_upload_123"
        
        # Upload thumbnail
        print("\nTesting thumbnail upload...")
        thumbnail_success, thumbnail_url = uploader.upload_thumbnail(test_image_path, test_id)
        if thumbnail_success:
            print(f"✅ Successfully uploaded thumbnail: {thumbnail_url}")
        else:
            print(f"❌ Failed to upload thumbnail: {thumbnail_url}")
        
        # Upload video
        print("\nTesting video upload...")
        video_success, video_url = uploader.upload_video(test_video_path, test_id)
        if video_success:
            print(f"✅ Successfully uploaded video: {video_url}")
        else:
            print(f"❌ Failed to upload video: {video_url}")
        
        # Clean up test files
        try:
            os.remove(test_image_path)
            os.remove(test_video_path)
            os.rmdir(temp_dir)
            print("\n✅ Cleaned up test files")
        except Exception as e:
            print(f"\n❌ Error cleaning up test files: {e}")
        
        # Overall result
        if thumbnail_success and video_success:
            print("\n✅ Storage uploader test completed successfully!")
            return True
        else:
            print("\n❌ Storage uploader test failed!")
            return False
        
    except Exception as e:
        print(f"❌ Error during storage uploader test: {e}")
        return False

if __name__ == "__main__":
    test_storage_uploader() 