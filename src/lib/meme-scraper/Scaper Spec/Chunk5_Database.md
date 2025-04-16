#### **Chunk 5: Store Data in PostgreSQL Database**
- **Goal**: Save the URL, extracted caption, and cropped video file path into a PostgreSQL database.
- **Tools**: `psycopg2` (database driver), PostgreSQL.
- **Steps**:
  1. Set up a PostgreSQL database and create a table:
     ```sql
     CREATE TABLE instagram_reels (
         id SERIAL PRIMARY KEY,
         url TEXT,
         caption_text TEXT,
         video_path TEXT
     );
     ```
  2. Write a Python script to:
     - Connect to the database.
     - Insert the URL, caption text, and cropped video path for each reel.
  3. Test with sample data to ensure successful insertion.
- **Example Code**:
  ```python
  import psycopg2

  conn = psycopg2.connect("dbname=mydb user=myuser password=mypass")
  cur = conn.cursor()
  url = "https://www.instagram.com/reel/VIDEO_ID1/"
  caption_text = "When PMs hear someone making a request directly to their devs instead of going through them"
  video_path = "cropped/VIDEO_ID1.mp4"
  cur.execute(
      "INSERT INTO instagram_reels (url, caption_text, video_path) VALUES (%s, %s, %s)",
      (url, caption_text, video_path)
  )
  conn.commit()
  cur.close()
  conn.close()
  ```
- **Output**: A database row per reel with the URL, caption, and video path stored.
- **Why**: This organizes the extracted data for easy access and future use. 