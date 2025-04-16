#!/usr/bin/env python3
import os
import sys
import json

def test_environment_variables():
    """Test that all required environment variables are present and valid."""
    
    print("=== Checking Environment Variables ===")
    
    # Check Supabase URL
    supabase_url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    print(f"NEXT_PUBLIC_SUPABASE_URL: {'✅ Set' if supabase_url else '❌ Missing'}")
    if supabase_url:
        print(f"    Value: {supabase_url}")
    
    # Check Supabase Service Key
    service_key = os.environ.get('SUPABASE_SERVICE_KEY')
    print(f"SUPABASE_SERVICE_KEY: {'✅ Set' if service_key else '❌ Missing'}")
    if service_key:
        print(f"    Value: {service_key[:15]}...{service_key[-5:]}")
    
    # Check Supabase Service Role Key
    service_role_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    print(f"SUPABASE_SERVICE_ROLE_KEY: {'✅ Set' if service_role_key else '❌ Missing'}")
    if service_role_key:
        print(f"    Value: {service_role_key[:15]}...{service_role_key[-5:]}")
    
    # Check Supabase DB URL
    db_url = os.environ.get('SUPABASE_DB_URL')
    print(f"SUPABASE_DB_URL: {'✅ Set' if db_url else '❌ Missing'}")
    if db_url:
        # Extract host from DB URL without showing full connection string (for security)
        if '@' in db_url and ':' in db_url:
            # Find position after the '@' symbol
            host_part = db_url.split('@')[1].split('/')[0]
            print(f"    Host: {host_part}")
        else:
            print(f"    Value: Invalid DB URL format")
    
    # Check if all required variables are present
    if supabase_url and (service_key or service_role_key) and db_url:
        print("\n✅ All required environment variables are set.")
    else:
        print("\n❌ Some required environment variables are missing.")
        
    # Try importing modules to check if dependencies are installed
    print("\n=== Checking Required Modules ===")
    modules_to_check = [
        "httpx", "magic", "psycopg2"
    ]
    
    for module in modules_to_check:
        try:
            __import__(module)
            print(f"{module}: ✅ Installed")
        except ImportError:
            print(f"{module}: ❌ Not installed")
    
    # Try importing local modules
    print("\n=== Checking Local Modules ===")
    modules_to_check = [
        "downloader", "frame_extractor", "video_cropper", "caption_extractor", 
        "storage_uploader", "db_manager"
    ]
    
    for module in modules_to_check:
        try:
            __import__(module)
            print(f"{module}: ✅ Available")
        except ImportError as e:
            print(f"{module}: ❌ Error importing: {e}")
    
    # Print Python version
    print(f"\nPython version: {sys.version}")
    print(f"Current directory: {os.getcwd()}")

if __name__ == "__main__":
    test_environment_variables() 