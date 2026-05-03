import yt_dlp
import os
import sys

def test_yt_subs(video_id):
    cookie_path = 'youtube_cookies.txt'
    opts = {
        'quiet': False,
        'no_warnings': False,
        'skip_download': True,
        'listsubtitles': True,
        'extract_flat': False,
    }
    if os.path.exists(cookie_path):
        opts['cookiefile'] = cookie_path
        print(f"Using cookies from {cookie_path}")
    else:
        print("No cookies found.")

    url = f"https://www.youtube.com/watch?v={video_id}"
    with yt_dlp.YoutubeDL(opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            subs = info.get('subtitles', {})
            autos = info.get('automatic_captions', {})
            print(f"\nSubtitles found: {list(subs.keys())}")
            print(f"Auto captions found: {list(autos.keys())}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    test_yt_subs('vOOWeXyYbQ8')
