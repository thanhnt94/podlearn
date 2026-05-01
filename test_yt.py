import yt_dlp
import os
import json

def test_yt():
    video_id = 'FFdGNpZTsR8' 
    # Try to find a real ID from the screenshot or just use a known one
    # Let's use the one from the user's previous requests if any, or a random one.
    
    import subprocess
    print("Checking JS runtimes...")
    try:
        subprocess.run(['node', '--version'], capture_output=True)
        print("Node.js found")
    except:
        print("Node.js NOT found")
    try:
        subprocess.run(['deno', '--version'], capture_output=True)
        print("Deno found")
    except:
        print("Deno NOT found")

    current_file = os.path.abspath(__file__)
    base_dir = os.path.dirname(current_file)
    cookie_path = os.path.join(base_dir, 'youtube_cookies.txt')
    
    opts = {
        'quiet': False,
        'skip_download': True,
        'listsubtitles': True,
        'writeautomaticsub': True,
    }
    
    if os.path.exists(cookie_path):
        opts['cookiefile'] = cookie_path
        print(f"Using cookies from {cookie_path}")
    
    url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            subs = info.get('subtitles', {})
            autos = info.get('automatic_captions', {})
            with open('yt_debug.json', 'w', encoding='utf-8') as f:
                json.dump({
                    "manual": list(subs.keys()),
                    "auto": list(autos.keys())
                }, f, indent=2)
            print("Successfully saved debug info to yt_debug.json")
    except Exception as e:
        with open('yt_error.txt', 'w', encoding='utf-8') as f:
            f.write(str(e))
        print(f"Error: {e}")

if __name__ == '__main__':
    test_yt()
