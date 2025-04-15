#!/usr/bin/env python3
import os
import sys
import psycopg2
from psycopg2 import sql

def test_db_connection():
    """Test connection to the Supabase PostgreSQL database."""
    print("=== Testing Database Connection ===")
    
    # Get the database URL from environment variables
    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        print("❌ SUPABASE_DB_URL environment variable is not set.")
        return False
    
    conn = None
    try:
        print(f"Attempting to connect to database...")
        # Don't log the full connection string for security reasons
        host_part = db_url.split('@')[1].split('/')[0] if '@' in db_url else "unknown"
        print(f"Database host: {host_part}")
        
        # Connect to the database
        conn = psycopg2.connect(db_url)
        print("✅ Successfully connected to the database.")
        
        # Test a simple query
        with conn.cursor() as cur:
            # Check if the unprocessed_templates table exists
            cur.execute("""
                SELECT EXISTS (
                   SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public'
                   AND table_name = 'unprocessed_templates'
                );
            """)
            table_exists = cur.fetchone()[0]
            
            if table_exists:
                print("✅ 'unprocessed_templates' table exists.")
                
                # Get the column names
                cur.execute("""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                    AND table_name = 'unprocessed_templates';
                """)
                columns = [row[0] for row in cur.fetchall()]
                print(f"Columns: {', '.join(columns)}")
                
                # Count existing records
                cur.execute("SELECT COUNT(*) FROM public.unprocessed_templates;")
                count = cur.fetchone()[0]
                print(f"Number of existing records: {count}")
                
                # Try inserting a test record
                try:
                    test_url = "https://www.instagram.com/reels/DIbYpKHR3xj/"
                    cur.execute("""
                        INSERT INTO public.unprocessed_templates 
                        (instagram_url, status) 
                        VALUES (%s, %s)
                        RETURNING id;
                    """, (test_url, 'test'))
                    test_id = cur.fetchone()[0]
                    print(f"✅ Successfully inserted test record with ID: {test_id}")
                    
                    # Delete the test record
                    cur.execute("DELETE FROM public.unprocessed_templates WHERE id = %s;", (test_id,))
                    print(f"✅ Successfully deleted test record.")
                    conn.commit()
                except Exception as e:
                    conn.rollback()
                    print(f"❌ Error during insert/delete test: {e}")
            else:
                print("❌ 'unprocessed_templates' table does not exist.")
        
        return True
        
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return False
        
    finally:
        if conn is not None:
            conn.close()
            print("Database connection closed.")

if __name__ == "__main__":
    test_db_connection() 