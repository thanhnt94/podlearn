import yt_dlp
import os
import sys

# Add app to path to use subtitle_service
sys.path.append(os.getcwd())
from app.services.subtitle_service import _get_ytdlp_opts

video_id = "FuAgtNwTDZI"
url = f"https://www.youtube.com/watch?v={video_id}"

opts = _get_ytdlp_opts({
    'extract_flat': False,
    'check_formats': False,
    'ignore_no_formats_error': True
})

print(f"Checking metadata for {video_id}...")
with yt_dlp.YoutubeDL(opts) as ydl:
    info = ydl.extract_info(url, download=False)
    if not info:
        print("No info returned!")
    else:
        formats = info.get('formats', [])
        print(f"Found {len(formats)} formats")
        for f in formats:
            print(f"Format: {f.get('format_id')} | Ext: {f.get('ext')} | ACodec: {f.get('acodec')} | VCodec: {f.get('vcodec')} | URL: {f.get('url')[:50]}...")
        
        audio_only = [f for f in formats if f.get('acodec') != 'none' and (f.get('vcodec') == 'none' or f.get('vcodec') is None)]
        print(f"Found {len(audio_only)} audio-only formats")
        if audio_only:
            best = audio_only[-1]
            print(f"Best audio URL (first 100 chars): {best.get('url')[:100]}...")
        else:
            print("No audio-only formats found!")
