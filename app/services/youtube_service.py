"""YouTube metadata service — fetch video info from a URL using yt-dlp."""

import re
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Regex patterns for YouTube video IDs
YT_PATTERNS = [
    re.compile(r'(?:youtube\.com/watch\?.*v=|youtu\.be/|youtube\.com/embed/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})'),
]


@dataclass
class VideoInfo:
    youtube_id: str
    title: str
    thumbnail_url: str
    duration_seconds: int


def extract_video_id(url: str) -> str | None:
    """Extract the 11-character YouTube video ID from various URL formats."""
    url = url.strip()
    # Direct ID (11 chars, no slashes)
    if re.match(r'^[a-zA-Z0-9_-]{11}$', url):
        return url
    for pattern in YT_PATTERNS:
        match = pattern.search(url)
        if match:
            return match.group(1)
    return None


def fetch_video_info(youtube_id: str) -> VideoInfo | None:
    """Fetch video metadata using yt-dlp. Returns None on failure."""
    try:
        import yt_dlp

        # Đảm bảo đường dẫn tuyệt đối cho cookies
        import os
        cookie_path = os.path.abspath(os.path.join(os.getcwd(), 'youtube_cookies.txt'))
        cookies_exist = os.path.exists(cookie_path)

        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'extract_flat': False,
            'socket_timeout': 10, # Ngừng treo nếu net lỗi
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        }
        
        if cookies_exist:
            ydl_opts['cookiefile'] = cookie_path


        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(
                f'https://www.youtube.com/watch?v={youtube_id}',
                download=False
            )

        if not info:
            return None

        return VideoInfo(
            youtube_id=youtube_id,
            title=info.get('title', 'Untitled'),
            thumbnail_url=info.get('thumbnail', f'https://img.youtube.com/vi/{youtube_id}/hqdefault.jpg'),
            duration_seconds=int(info.get('duration', 0)),
        )

    except Exception as e:
        logger.error(f'Failed to fetch video info for {youtube_id}: {e}')
        return None
