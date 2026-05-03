import yt_dlp
import os

def test_yt_subs_no_list(video_id):
    opts = {
        'quiet': True,
        'skip_download': True,
        # 'listsubtitles': False, # default
    }
    url = f"https://www.youtube.com/watch?v={video_id}"
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
        subs = info.get('subtitles', {})
        print(f"Subtitles found: {list(subs.keys())}")

if __name__ == "__main__":
    test_yt_subs_no_list('vOOWeXyYbQ8')
