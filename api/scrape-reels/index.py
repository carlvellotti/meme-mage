from flask import Flask, request, jsonify
import sys
import os
import json
from importlib import util

# Add the 'src' directory to the Python path to allow imports
# This assumes the script runs from the 'api/scrape-reels' directory relative to the project root
# Go up two levels to reach the project root
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
src_path = os.path.join(project_root, 'src')
if src_path not in sys.path:
    sys.path.insert(0, src_path)

# Dynamically import the process_reels function
# This is slightly more complex but avoids potential path issues in serverless envs
module_name = "process_reels"
file_path = os.path.join(project_root, "src/lib/meme-scraper/process_reels.py")

spec = util.spec_from_file_location(module_name, file_path)
if spec is None:
    raise ImportError(f"Could not load spec for module '{module_name}' at path '{file_path}'")
process_reels_module = util.module_from_spec(spec)
if spec.loader is None:
    raise ImportError(f"Spec for module '{module_name}' has no loader")
sys.modules[module_name] = process_reels_module # Add to sys.modules before exec
spec.loader.exec_module(process_reels_module)

# Now we can import the function
try:
    from process_reels import process_reels
except ImportError as e:
     # Provide more context if the import fails
    raise ImportError(f"Failed to import 'process_reels' from {file_path}. Ensure the function exists and the path is correct. Original error: {e}")


app = Flask(__name__)

# Vercel maps requests to /api/scrape-reels to this index.py file.
# The route within the file handles the base path.
@app.route('/', methods=['POST'])
def handle_scrape_reels():
    """
    Handles POST requests to scrape Instagram Reels.
    Expects a JSON body with a 'urls' key containing a list of strings.
    """
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 415

    data = request.get_json()
    urls = data.get('urls')

    if not urls or not isinstance(urls, list):
        return jsonify({"error": "Missing or invalid 'urls' list in request body"}), 400

    try:
        # Assuming process_reels takes a list of URLs and returns a serializable result (e.g., dict)
        # And raises exceptions on failure.
        # Note: process_reels might need to be async if it's I/O bound and Flask is run with an async worker (like gunicorn+uvicorn)
        # For Vercel's default WSGI runner, synchronous should be fine.
        result = process_reels(urls)
        return jsonify({"success": True, "data": result}), 200
    except Exception as e:
        # Log the exception for debugging (Vercel logs)
        print(f"Error processing reels: {e}", file=sys.stderr)
        # Consider returning a more specific error message depending on the exception type
        return jsonify({"error": f"An error occurred during processing: {str(e)}"}), 500

# Vercel expects the app to be named 'app' by default
# The file itself acts as the entry point
if __name__ == "__main__":
    # This part is only for direct local testing (e.g., python api/scrape-reels/index.py)
    # Vercel runs the handler function directly via the WSGI interface (app)
    app.run(debug=True, port=5001) # Use a different port if 5000 is common 